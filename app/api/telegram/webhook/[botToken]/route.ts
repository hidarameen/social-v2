import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TwitterClient, refreshTwitterToken } from '@/platforms/twitter/client';
import { TelegramClient } from '@/platforms/telegram/client';
import { executeYouTubePublish } from '@/lib/services/youtube-actions';
import { publishFacebookPhotoAlbum, publishToFacebook } from '@/lib/services/facebook-publish';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { debugLog, debugError } from '@/lib/debug';
import { getOAuthClientCredentials } from '@/lib/platform-credentials';
import { executionQueue } from '@/lib/services/execution-queue';
import { createVideoProgressLogger } from '@/lib/services/video-progress';
import { getPlatformApiProviderForUser } from '@/lib/platforms/provider';
import { getPlatformHandlerForUser } from '@/lib/platforms/handlers';
import type { PlatformId, PostRequest } from '@/lib/platforms/types';
import {
  createBufferPublishTokenForAccount,
  getBufferUserSettings,
} from '@/lib/buffer-user-settings';
import {
  buildTelegramBotFileUrl,
  buildTelegramBotMethodUrl,
  getTelegramApiBaseUrl,
  looksLikeTelegramCloudApi,
} from '@/lib/telegram-api';
import { ensureTelegramLocalApiServer } from '@/lib/telegram-local-api';

export const runtime = 'nodejs';

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    media_group_id?: string;
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    video?: { file_id: string; file_unique_id: string; width?: number; height?: number; duration?: number; mime_type?: string; file_size?: number };
    document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
  channel_post?: {
    message_id: number;
    media_group_id?: string;
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    video?: { file_id: string; file_unique_id: string; width?: number; height?: number; duration?: number; mime_type?: string; file_size?: number };
    document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
};

function extractMessage(update: TelegramUpdate) {
  return update.message || update.channel_post || null;
}

type PickedTelegramMedia =
  | { kind: 'photo'; fileId: string; mimeType: string; fileSize?: number }
  | { kind: 'video'; fileId: string; mimeType: string; durationSec?: number; fileSize?: number };

type TelegramIncomingMessage = NonNullable<TelegramUpdate['message']> | NonNullable<TelegramUpdate['channel_post']>;

type TelegramSourceAccount = Awaited<ReturnType<typeof db.getAllAccounts>>[number];

type TelegramProcessingContext = {
  account: TelegramSourceAccount;
  botToken: string;
  chatId?: string;
  triggerMessage: TelegramIncomingMessage;
  groupedMessages: TelegramIncomingMessage[];
};

type BufferedMediaGroup = {
  groupKey: string;
  accountId: string;
  chatId: string;
  mediaGroupId: string;
  botToken: string;
};

const TELEGRAM_MEDIA_GROUP_WAIT_MS = (() => {
  const parsed = Number(process.env.TELEGRAM_MEDIA_GROUP_WAIT_MS || '2500');
  if (!Number.isFinite(parsed)) return 2500;
  return Math.max(200, parsed);
})();
const TELEGRAM_MEDIA_GROUP_STALE_CLAIM_MS = (() => {
  const parsed = Number(process.env.TELEGRAM_MEDIA_GROUP_STALE_CLAIM_MS || '120000');
  if (!Number.isFinite(parsed)) return 120000;
  return Math.max(5000, parsed);
})();
const mediaGroupTimers = new Map<string, NodeJS.Timeout>();
const MANAGED_PLATFORM_IDS = new Set<PlatformId>([
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'telegram',
  'linkedin',
]);

function asManagedPlatformId(platformId: string): PlatformId | null {
  if (MANAGED_PLATFORM_IDS.has(platformId as PlatformId)) {
    return platformId as PlatformId;
  }
  return null;
}

async function buildBufferPublishToken(target: TelegramSourceAccount): Promise<string> {
  const settings = await getBufferUserSettings(target.userId);
  return createBufferPublishTokenForAccount({
    userId: target.userId,
    accessToken: settings.accessToken,
    baseUrl: settings.baseUrl,
    applyToAllAccounts: settings.applyToAllAccounts,
    account: target,
  });
}

function pickTelegramMedia(message: NonNullable<ReturnType<typeof extractMessage>>): PickedTelegramMedia | null {
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    return {
      kind: 'photo' as const,
      fileId: largest.file_id,
      mimeType: 'image/jpeg',
      fileSize: largest.file_size,
    };
  }
  if (message.video?.file_id) {
    return {
      kind: 'video' as const,
      fileId: message.video.file_id,
      mimeType: message.video.mime_type || 'video/mp4',
      durationSec: message.video.duration,
      fileSize: message.video.file_size,
    };
  }
  if (message.document?.file_id && message.document.mime_type?.startsWith('image/')) {
    return {
      kind: 'photo' as const,
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    };
  }
  if (message.document?.file_id && message.document.mime_type?.startsWith('video/')) {
    return {
      kind: 'video' as const,
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      fileSize: message.document.file_size,
    };
  }
  return null;
}

function extractMessageText(message: TelegramIncomingMessage): string {
  return message.text || message.caption || '';
}

function normalizeMediaGroupMessages(messages: TelegramIncomingMessage[]): TelegramIncomingMessage[] {
  const byId = new Map<number, TelegramIncomingMessage>();
  for (const msg of messages) {
    if (!byId.has(msg.message_id)) {
      byId.set(msg.message_id, msg);
    }
  }
  return [...byId.values()].sort((a, b) => a.message_id - b.message_id);
}

function buildMediaGroupKey(accountId: string, chatId: string, mediaGroupId: string): string {
  return `${accountId}:${chatId}:${mediaGroupId}`;
}

function selectTwitterMediaForTweet(mediaItems: PickedTelegramMedia[]): {
  selected: PickedTelegramMedia[];
  droppedCount: number;
  mode: 'video_single' | 'photo_multi';
} {
  const firstVideo = mediaItems.find(item => item.kind === 'video');
  if (firstVideo) {
    return {
      selected: [firstVideo],
      droppedCount: Math.max(0, mediaItems.length - 1),
      mode: 'video_single',
    };
  }

  const selected = mediaItems.slice(0, 4);
  return {
    selected,
    droppedCount: Math.max(0, mediaItems.length - selected.length),
    mode: 'photo_multi',
  };
}

async function fetchTelegramFileToTemp(botToken: string, fileId: string, fileSize?: number) {
  let telegramApiBaseUrl = getTelegramApiBaseUrl();
  let localApiFailureReason: string | undefined;

  if (!looksLikeTelegramCloudApi(telegramApiBaseUrl)) {
    const ensured = await ensureTelegramLocalApiServer(telegramApiBaseUrl);
    if (!ensured.ok) {
      localApiFailureReason = ensured.reason || 'Local API is unavailable';
      const allowCloudFallback =
        String(process.env.TELEGRAM_LOCAL_API_FALLBACK_TO_CLOUD || 'true') !== 'false';
      if (!allowCloudFallback) {
        throw new Error(
          `Telegram Local Bot API is unreachable at ${telegramApiBaseUrl}. ${localApiFailureReason}`
        );
      }
      debugLog('Telegram local API unavailable, falling back to cloud API', {
        apiBaseUrl: telegramApiBaseUrl,
        reason: localApiFailureReason,
      });
      telegramApiBaseUrl = 'https://api.telegram.org';
    }
  }

  const usingCloudApi = looksLikeTelegramCloudApi(telegramApiBaseUrl);
  const localApiHint =
    `Telegram Local Bot API is unreachable at ${telegramApiBaseUrl}. ` +
    `Start the local server or update TELEGRAM_LOCAL_API_BASE_URL.`;
  const maxDownloadBytes = (() => {
    const parsed = Number(process.env.TELEGRAM_DOWNLOAD_MAX_BYTES || '');
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return usingCloudApi
      ? 20 * 1024 * 1024
      : 2048 * 1024 * 1024;
  })();

  if (typeof fileSize === 'number' && fileSize > maxDownloadBytes) {
    const suffix =
      usingCloudApi && localApiFailureReason
        ? ` Local API auto-start failed: ${localApiFailureReason}`
        : '';
    throw new Error(
      `Telegram file is too large (${Math.round(fileSize / (1024 * 1024))}MB). ` +
      `Configured download limit is ${Math.round(maxDownloadBytes / (1024 * 1024))}MB.` +
      suffix
    );
  }

  const getFileAttempts: Array<{ url: string; init?: RequestInit }> = [
    {
      url: buildTelegramBotMethodUrl(botToken, 'getFile', telegramApiBaseUrl),
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      },
    },
    {
      url: `${buildTelegramBotMethodUrl(botToken, 'getFile', telegramApiBaseUrl)}?file_id=${encodeURIComponent(fileId)}`,
      init: { method: 'GET' },
    },
  ];

  let lastGetFileError = 'Unknown Telegram getFile error';
  let filePath = '';
  for (const attempt of getFileAttempts) {
    let metaRes: Response;
    try {
      metaRes = await fetch(attempt.url, attempt.init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'fetch failed';
      lastGetFileError = usingCloudApi
        ? `Telegram getFile request failed: ${reason}`
        : `${localApiHint} getFile request failed: ${reason}`;
      filePath = '';
      continue;
    }
    const meta = (await metaRes.json().catch(() => null)) as any;
    filePath = String(meta?.result?.file_path || '');

    if (metaRes.ok && meta?.ok && filePath) {
      break;
    }

    const retryAfter = Number(meta?.parameters?.retry_after);
    const retryHint =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? ` (retry after ${retryAfter}s)`
        : '';
    const description = String(meta?.description || metaRes.statusText || 'Bad Request');
    const descriptionLower = description.toLowerCase();
    if (descriptionLower.includes('file is too big')) {
      const localReason = localApiFailureReason
        ? ` Local API auto-start failure: ${localApiFailureReason}.`
        : '';
      const endpointHint = ` Current endpoint: ${telegramApiBaseUrl}.`;
      lastGetFileError = usingCloudApi
        ? 'Telegram file is too large for cloud Bot API (20MB limit). ' +
          'A native Local Telegram Bot API server is required for large files.' +
          endpointHint +
          localReason
        : 'Telegram endpoint returned "file is too big". ' +
          'This usually means you are using a proxy/cloud-backed endpoint, not a native local telegram-bot-api server. ' +
          'To support large files, run native telegram-bot-api and set TELEGRAM_LOCAL_API_MODE=binary.' +
          endpointHint +
          localReason;
      filePath = '';
      break;
    }
    lastGetFileError = `Telegram getFile failed: ${description}${retryHint}`;
    filePath = '';
  }

  if (!filePath) {
    throw new Error(`${lastGetFileError} [file_id=${fileId}]`);
  }
  if (!usingCloudApi && filePath.startsWith('/')) {
    // Native local telegram-bot-api can return an absolute local file path.
    // In this mode we should copy directly from disk instead of using /file/bot... URL.
    let tempPath: string | undefined;
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        throw new Error(`Telegram local file path is not a file: ${filePath}`);
      }
      tempPath = `/tmp/telegram-media-${randomUUID()}`;
      await fs.copyFile(filePath, tempPath);
      const copied = await fs.stat(tempPath);
      return { tempPath, fileUrl: filePath, size: copied.size };
    } catch (error) {
      await cleanupTempFile(tempPath);
      const reason = error instanceof Error ? error.message : 'Unknown local file read error';
      throw new Error(`Telegram local file access failed: ${reason}`);
    }
  }
  const relativePath = String(filePath).replace(/^\/+/, '');
  const directPath = `${getTelegramApiBaseUrl(telegramApiBaseUrl)}/${relativePath}`;
  const botFilePath =
    relativePath.startsWith('file/bot') ? directPath : buildTelegramBotFileUrl(botToken, filePath, telegramApiBaseUrl);
  const downloadCandidates = [...new Set([botFilePath, directPath])];

  let lastDownloadError = '';
  for (const fileUrl of downloadCandidates) {
    let fileRes: Response;
    try {
      fileRes = await fetch(fileUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'fetch failed';
      lastDownloadError = reason;
      continue;
    }
    if (!fileRes.ok) {
      const bodyText = await fileRes.text().catch(() => '');
      lastDownloadError =
        `Telegram file download failed (${fileRes.status} ${fileRes.statusText})` +
        (bodyText ? `: ${bodyText.slice(0, 240)}` : '');
      continue;
    }
    let tempPath: string | undefined;
    try {
      tempPath = `/tmp/telegram-media-${randomUUID()}`;
      const stream = fileRes.body ? Readable.fromWeb(fileRes.body as any) : null;
      if (!stream) {
        throw new Error('Telegram file stream missing');
      }
      await pipeline(stream, createWriteStream(tempPath));
      const stat = await fs.stat(tempPath);
      return { tempPath, fileUrl, size: stat.size };
    } catch (error) {
      await cleanupTempFile(tempPath);
      lastDownloadError = error instanceof Error ? error.message : 'Unknown stream error';
    }
  }

  if (usingCloudApi) {
    throw new Error(lastDownloadError || 'Telegram file download request failed');
  }
  throw new Error(lastDownloadError || `${localApiHint} file download request failed`);
}

async function cleanupTempFile(tempPath: string | undefined): Promise<void> {
  if (!tempPath) return;
  await fs.unlink(tempPath).catch(() => undefined);
}

function isTwitterUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  return lower.includes('401') || lower.includes('unauthorized');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

function shouldFallbackToTextOnlyForTelegramMediaError(error: unknown, text: string): boolean {
  if (!text.trim()) return false;
  const lower = getErrorMessage(error).toLowerCase();
  return (
    lower.includes('telegram getfile failed') ||
    lower.includes('telegram file is too large') ||
    lower.includes('telegram file download failed') ||
    lower.includes('invalid file_id') ||
    lower.includes('file is too big')
  );
}

async function withTwitterClientRetry<T>(
  target: { id: string; userId: string; accessToken: string; refreshToken?: string },
  operation: (client: TwitterClient) => Promise<T>
): Promise<T> {
  let accessToken = target.accessToken;
  let refreshToken = target.refreshToken;
  let refreshed = false;

  while (true) {
    try {
      return await operation(new TwitterClient(accessToken));
    } catch (error) {
      if (!refreshToken || refreshed || !isTwitterUnauthorizedError(error)) {
        throw error;
      }
      const oauthCreds = await getOAuthClientCredentials(target.userId, 'twitter');
      const next = await refreshTwitterToken(refreshToken, oauthCreds);
      accessToken = next.accessToken;
      refreshToken = next.refreshToken ?? refreshToken;
      refreshed = true;

      await db.updateAccount(target.id, { accessToken, refreshToken });
      target.accessToken = accessToken;
      target.refreshToken = refreshToken;
      debugLog('Twitter access token refreshed during Telegram webhook', { targetId: target.id });
    }
  }
}

function scheduleTelegramMediaGroupFlush(group: BufferedMediaGroup) {
  const existing = mediaGroupTimers.get(group.groupKey);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    mediaGroupTimers.delete(group.groupKey);
    void flushTelegramMediaGroup(group).catch(error => {
      debugError('Telegram media-group flush failed', error, {
        accountId: group.accountId,
        groupKey: group.groupKey,
        mediaGroupId: group.mediaGroupId,
      });
    });
  }, TELEGRAM_MEDIA_GROUP_WAIT_MS);

  mediaGroupTimers.set(group.groupKey, timer);
}

async function flushTelegramMediaGroup(group: BufferedMediaGroup): Promise<void> {
  const account = await db.getAccount(group.accountId);
  if (!account || account.platformId !== 'telegram' || !account.isActive) {
    debugLog('Telegram media-group flush skipped: source account unavailable', {
      accountId: group.accountId,
      groupKey: group.groupKey,
      mediaGroupId: group.mediaGroupId,
    });
    return;
  }

  const ownerId = randomUUID();
  const claimed = await db.tryClaimTelegramMediaGroup({
    groupKey: group.groupKey,
    ownerId,
    quietWindowMs: TELEGRAM_MEDIA_GROUP_WAIT_MS,
    staleClaimMs: TELEGRAM_MEDIA_GROUP_STALE_CLAIM_MS,
  });

  if (!claimed) {
    const pending = await db.isTelegramMediaGroupPending(group.groupKey).catch(() => false);
    if (pending) {
      scheduleTelegramMediaGroupFlush(group);
    }
    debugLog('Telegram media-group flush skipped: group not ready or already claimed', {
      accountId: group.accountId,
      groupKey: group.groupKey,
      mediaGroupId: group.mediaGroupId,
      pending,
    });
    return;
  }

  try {
    const grouped = await db.getTelegramMediaGroupMessages(group.groupKey);
    const groupedMessages = normalizeMediaGroupMessages(
      grouped.filter(Boolean) as TelegramIncomingMessage[]
    );

    if (groupedMessages.length === 0) {
      await db.releaseTelegramMediaGroupClaim(group.groupKey, ownerId).catch(() => undefined);
      return;
    }

    await db.markTelegramMediaGroupProcessed(group.groupKey, ownerId);
    void db.cleanupTelegramMediaGroups().catch(() => undefined);

    await executionQueue.enqueue({
      label: 'telegram:media-group',
      userId: account.userId,
      taskId: `telegram-account:${account.id}:group:${group.groupKey}`,
      dedupeKey: `telegram:media-group:${group.groupKey}`,
      run: async () =>
        processTelegramMessages({
          account,
          botToken: group.botToken,
          chatId: groupedMessages[0]?.chat?.id?.toString() || group.chatId,
          triggerMessage: groupedMessages[0],
          groupedMessages,
        }),
    });

    debugLog('Telegram media-group processed', {
      accountId: group.accountId,
      groupKey: group.groupKey,
      mediaGroupId: group.mediaGroupId,
      groupedCount: groupedMessages.length,
    });
  } catch (error) {
    await db.releaseTelegramMediaGroupClaim(group.groupKey, ownerId).catch(() => undefined);
    throw error;
  }
}

type TelegramTaskDispatchContext = {
  account: TelegramSourceAccount;
  botToken: string;
  task: any;
  accountsById: Map<string, TelegramSourceAccount>;
  text: string;
  mediaItems: PickedTelegramMedia[];
};

async function dedupeBufferTargets(targets: TelegramSourceAccount[]): Promise<TelegramSourceAccount[]> {
  const selected: TelegramSourceAccount[] = [];
  const seenBufferTargets = new Set<string>();

  for (const target of targets) {
    const managedTargetPlatformId = asManagedPlatformId(target.platformId);
    if (!managedTargetPlatformId) {
      selected.push(target);
      continue;
    }

    const provider = await getPlatformApiProviderForUser(target.userId, managedTargetPlatformId);
    if (provider !== 'buffer') {
      selected.push(target);
      continue;
    }

    const dedupeKey = `${target.userId}:${managedTargetPlatformId}`;
    if (seenBufferTargets.has(dedupeKey)) {
      continue;
    }
    seenBufferTargets.add(dedupeKey);
    selected.push(target);
  }

  return selected;
}

async function processTelegramTask({
  account,
  botToken,
  task,
  accountsById,
  text,
  mediaItems,
}: TelegramTaskDispatchContext): Promise<void> {
  const executionGroupId = `telegram-webhook:${task.id}:${account.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;
  const targets = (task.targetAccounts as string[])
    .map((id: string) => accountsById.get(id))
    .filter((a: TelegramSourceAccount | undefined): a is TelegramSourceAccount => Boolean(a))
    .filter((a: TelegramSourceAccount) => a.isActive);
  const normalizedTargets = await dedupeBufferTargets(targets);

  let failures = 0;

  const targetResults = await Promise.allSettled(normalizedTargets.map(async (target) => {
    let status: 'success' | 'failed' = 'success';
    let errorMessage: string | undefined;
    let responseData: any = undefined;
    let transformedContent = text;
    const liveExecution = await db.createExecution({
      taskId: task.id,
      sourceAccount: account.id,
      targetAccount: target.id,
      originalContent: text,
      transformedContent,
      status: 'pending',
      executedAt: new Date(),
      responseData: {
        sourcePlatformId: account.platformId,
        targetPlatformId: target.platformId,
        executionGroupId,
        progress: 12,
        stage: 'processing',
      },
    });
    let progressWriteChain = Promise.resolve();
    let latestLiveProgress = 12;
    const pushLiveProgress = (percent: number, stage: string) => {
      const mappedProgress = Math.max(
        latestLiveProgress,
        Math.max(14, Math.min(94, Math.round(14 + percent * 0.8)))
      );
      latestLiveProgress = mappedProgress;
      progressWriteChain = progressWriteChain
        .then(async () => {
          await db.updateExecution(liveExecution.id, {
            responseData: {
              sourcePlatformId: account.platformId,
              targetPlatformId: target.platformId,
              progress: mappedProgress,
              stage,
            },
          });
        })
        .catch(() => undefined);
      return progressWriteChain;
    };

    try {
      await db.updateExecution(liveExecution.id, {
        responseData: {
          sourcePlatformId: account.platformId,
          targetPlatformId: target.platformId,
          progress: 30,
          stage: 'publishing',
        },
      });
      const managedTargetPlatformId = asManagedPlatformId(target.platformId);
      const targetProvider =
        managedTargetPlatformId
          ? await getPlatformApiProviderForUser(target.userId, managedTargetPlatformId)
          : 'native';
      if (managedTargetPlatformId && targetProvider === 'buffer') {
        debugLog('Telegram -> Buffer start', {
          taskId: task.id,
          targetId: target.id,
          platformId: managedTargetPlatformId,
        });
        const handler = await getPlatformHandlerForUser(target.userId, managedTargetPlatformId);
        const postRequest: PostRequest = { content: text };

        const firstMedia = mediaItems[0];
        if (firstMedia) {
          try {
            const downloaded = await fetchTelegramFileToTemp(
              botToken,
              firstMedia.fileId,
              firstMedia.fileSize
            );
            try {
              if (downloaded.fileUrl && /^https?:\/\//i.test(downloaded.fileUrl)) {
                postRequest.media = {
                  type: firstMedia.kind === 'video' ? 'video' : 'image',
                  url: downloaded.fileUrl,
                };
              }
            } finally {
              await cleanupTempFile(downloaded.tempPath);
            }
          } catch (error) {
            debugLog('Telegram -> Buffer media fallback to text-only', {
              taskId: task.id,
              targetId: target.id,
              reason: getErrorMessage(error),
            });
          }
        }

        transformedContent = text;
        const bufferResponse = await handler.publishPost(
          postRequest,
          await buildBufferPublishToken(target)
        );
        if (!bufferResponse.success) {
          throw new Error(bufferResponse.error || 'Buffer publish failed');
        }
        responseData = {
          id: bufferResponse.postId,
          url: bufferResponse.url,
          provider: 'buffer',
        };
      } else if (target.platformId === 'twitter') {
        debugLog('Telegram -> Twitter start', { taskId: task.id, targetId: target.id });
        const tweetText = text;
        transformedContent = tweetText;
        responseData = await withTwitterClientRetry(target, async (client) => {
          const mediaPlan = selectTwitterMediaForTweet(mediaItems);
          if (mediaPlan.droppedCount > 0) {
            debugLog('Telegram media trimmed to fit Twitter tweet constraints', {
              taskId: task.id,
              targetId: target.id,
              incomingMediaCount: mediaItems.length,
              selectedMediaCount: mediaPlan.selected.length,
              droppedMediaCount: mediaPlan.droppedCount,
              mode: mediaPlan.mode,
            });
          }

          if (mediaPlan.selected.length > 0) {
            const tempPaths: string[] = [];
            const uploadedMedia: Array<{ mediaKey: string; type: 'video' | 'photo' }> = [];
            const totalProgressSteps = mediaPlan.selected.length * 2 + 2;
            const progress = createVideoProgressLogger({
              flow: 'telegram-to-twitter',
              platform: 'twitter',
              taskId: task.id,
              targetId: target.id,
              onProgress: ({ percent, stage }) => {
                void pushLiveProgress(percent, stage);
              },
            });
            progress(1, totalProgressSteps, 'prepare-media-upload', {
              mediaTotal: mediaPlan.selected.length,
              droppedMediaCount: mediaPlan.droppedCount,
            });
            let progressStep = 1;
            try {
              for (let idx = 0; idx < mediaPlan.selected.length; idx += 1) {
                const media = mediaPlan.selected[idx];
                void pushLiveProgress(
                  Math.round((progressStep / totalProgressSteps) * 100),
                  `downloading-${media.kind}-from-telegram`
                );
                const { tempPath } = await fetchTelegramFileToTemp(botToken, media.fileId, media.fileSize);
                tempPaths.push(tempPath);
                progressStep += 1;
                progress(progressStep, totalProgressSteps, `${media.kind}-downloaded-from-telegram`, {
                  mediaIndex: idx + 1,
                  mediaTotal: mediaPlan.selected.length,
                  mediaKind: media.kind,
                });
                debugLog('Telegram media downloaded', {
                  taskId: task.id,
                  targetId: target.id,
                  tempPath,
                  mediaKind: media.kind,
                });

                const uploadWindowStartPercent = Math.round((progressStep / totalProgressSteps) * 100);
                const uploadWindowEndPercent = Math.round(((progressStep + 1) / totalProgressSteps) * 100);

                const mediaId = await client.uploadMediaFromFile(tempPath, media.mimeType, {
                  durationSec: media.kind === 'video' ? media.durationSec : undefined,
                  premiumVideo: Boolean((target.credentials as any)?.twitterPremiumVideo),
                  onProgress: ({ percent, stage }) => {
                    const stageWithContext =
                      stage === 'upload-start'
                        ? `starting-${media.kind}-upload-to-twitter`
                        : stage === 'uploading'
                          ? `uploading-${media.kind}-to-twitter`
                          : stage === 'upload-complete' || stage === 'done'
                            ? `${media.kind}-uploaded-to-twitter`
                            : stage;
                    const bounded = Math.max(0, Math.min(100, Number(percent) || 0));
                    const windowPercent =
                      uploadWindowStartPercent +
                      Math.round(((uploadWindowEndPercent - uploadWindowStartPercent) * bounded) / 100);
                    void pushLiveProgress(windowPercent, stageWithContext);
                  },
                });
                uploadedMedia.push({
                  mediaKey: mediaId,
                  type: media.kind === 'video' ? 'video' : 'photo',
                });
                progressStep += 1;
                progress(progressStep, totalProgressSteps, `${media.kind}-uploaded-to-twitter`, {
                  mediaIndex: idx + 1,
                  mediaTotal: mediaPlan.selected.length,
                  mediaKind: media.kind,
                });
              }

              debugLog('Twitter media uploaded', {
                taskId: task.id,
                targetId: target.id,
                mediaCount: uploadedMedia.length,
                mode: mediaPlan.mode,
              });
              const result = await client.tweet({
                text: tweetText,
                media: uploadedMedia,
              });
              progress(totalProgressSteps, totalProgressSteps, 'tweet-posted', {
                tweetId: result.id,
                mediaTotal: uploadedMedia.length,
              });
              debugLog('Twitter tweet posted', {
                taskId: task.id,
                targetId: target.id,
                tweetId: result.id,
                mediaCount: uploadedMedia.length,
              });
              return {
                id: result.id,
                mediaIds: uploadedMedia.map(item => item.mediaKey),
                uploadedMediaCount: uploadedMedia.length,
                droppedMediaCount: mediaPlan.droppedCount,
              };
            } finally {
              await Promise.all(tempPaths.map(tempPath => cleanupTempFile(tempPath)));
            }
          }
          const result = await client.tweet({ text: tweetText });
          debugLog('Twitter tweet posted (no media)', { taskId: task.id, tweetId: result.id });
          return { id: result.id };
        });
      } else if (target.platformId === 'telegram') {
        debugLog('Telegram -> Telegram start', { taskId: task.id, targetId: target.id });
        const targetChatId = (target.credentials as any)?.chatId;
        if (!targetChatId) {
          throw new Error('Missing Telegram target chat ID');
        }
        const client = new TelegramClient(target.accessToken);
        const result = await client.sendMessage(targetChatId, text);
        debugLog('Telegram message forwarded', { taskId: task.id, messageId: result.messageId });
        responseData = { messageId: result.messageId };
      } else if (target.platformId === 'youtube') {
        debugLog('Telegram -> YouTube start', { taskId: task.id, targetId: target.id });
        const videos = mediaItems.filter(item => item.kind === 'video');
        const firstVideo = videos[0];

        if (firstVideo) {
          void pushLiveProgress(20, 'downloading-video-from-telegram');
          const { tempPath } = await fetchTelegramFileToTemp(botToken, firstVideo.fileId, firstVideo.fileSize);
          try {
            const result = await executeYouTubePublish({
              target,
              filePath: tempPath,
              mimeType: firstVideo.mimeType || 'video/mp4',
              transformations: task.transformations,
              context: {
                taskId: task.id,
                text,
                date: new Date().toISOString(),
              },
              onProgress: ({ percent, stage }) => {
                void pushLiveProgress(percent, stage);
              },
            });
            responseData = {
              id: result.id,
              url: result.url,
              playlistItemId: result.playlistItemId,
              publishMode: 'video_upload',
            };
          } finally {
            await cleanupTempFile(tempPath);
          }
          debugLog('Telegram -> YouTube upload success', {
            taskId: task.id,
            targetId: target.id,
            videoId: responseData?.id,
          });
        } else {
          throw new Error(
            'YouTube targets accept video uploads only. Skipping non-video content.'
          );
        }
      } else if (target.platformId === 'facebook') {
        debugLog('Telegram -> Facebook start', { taskId: task.id, targetId: target.id });
        const videos = mediaItems.filter(item => item.kind === 'video');
        const photos = mediaItems.filter(item => item.kind === 'photo');
        const allowTextOnlyFallback =
          String(process.env.TELEGRAM_FACEBOOK_TEXT_ONLY_FALLBACK || 'false') === 'true';
        const publishTextOnlyFallback = async (reason: string) => {
          debugLog('Telegram -> Facebook fallback to text-only', {
            taskId: task.id,
            targetId: target.id,
            reason,
          });
          const result = await publishToFacebook({
            target,
            message: text,
            onProgress: ({ percent, stage }) => {
              void pushLiveProgress(percent, stage);
            },
          });
          responseData = {
            id: result.id,
            url: result.url,
            nodeId: result.nodeId,
            fallback: 'text_only',
            fallbackReason: reason,
          };
        };

        if (videos.length === 0 && photos.length > 1) {
          const maxAlbumPhotos = 10;
          const selectedPhotos = photos.slice(0, maxAlbumPhotos);
          if (photos.length > selectedPhotos.length) {
            debugLog('Telegram Facebook album photos trimmed', {
              taskId: task.id,
              targetId: target.id,
              incomingPhotos: photos.length,
              selectedPhotos: selectedPhotos.length,
            });
          }

          const tempPaths: string[] = [];
          try {
            const albumPhotos: Array<{ filePath: string; mimeType?: string }> = [];
            for (const photo of selectedPhotos) {
              void pushLiveProgress(22, 'downloading-image-from-telegram');
              const { tempPath } = await fetchTelegramFileToTemp(botToken, photo.fileId, photo.fileSize);
              tempPaths.push(tempPath);
              albumPhotos.push({
                filePath: tempPath,
                mimeType: photo.mimeType || 'image/jpeg',
              });
            }

            const result = await publishFacebookPhotoAlbum({
              target,
              message: text,
              photos: albumPhotos,
              onProgress: ({ percent, stage }) => {
                void pushLiveProgress(percent, stage);
              },
            });
            responseData = {
              id: result.id,
              url: result.url,
              nodeId: result.nodeId,
              album: true,
              mediaCount: albumPhotos.length,
            };
          } catch (error) {
            if (allowTextOnlyFallback && shouldFallbackToTextOnlyForTelegramMediaError(error, text)) {
              await publishTextOnlyFallback(getErrorMessage(error));
            } else {
              throw error;
            }
          } finally {
            await Promise.all(tempPaths.map(path => cleanupTempFile(path)));
          }
        } else if (videos.length > 0) {
          if (mediaItems.length > 1) {
            debugLog('Telegram media trimmed for Facebook video publish', {
              taskId: task.id,
              targetId: target.id,
              incomingMediaCount: mediaItems.length,
            });
          }

          const firstVideo = videos[0];
          let tempPath: string | undefined;
          try {
            void pushLiveProgress(20, 'downloading-video-from-telegram');
            const downloaded = await fetchTelegramFileToTemp(botToken, firstVideo.fileId, firstVideo.fileSize);
            tempPath = downloaded.tempPath;
            const result = await publishToFacebook({
              target,
              message: text,
              media: {
                kind: 'video',
                filePath: tempPath,
                mimeType: firstVideo.mimeType || 'video/mp4',
              },
              onProgress: ({ percent, stage }) => {
                void pushLiveProgress(percent, stage);
              },
            });
            responseData = {
              id: result.id,
              url: result.url,
              nodeId: result.nodeId,
            };
          } catch (error) {
            if (allowTextOnlyFallback && shouldFallbackToTextOnlyForTelegramMediaError(error, text)) {
              await publishTextOnlyFallback(getErrorMessage(error));
            } else {
              throw error;
            }
          } finally {
            await cleanupTempFile(tempPath);
          }
        } else if (photos.length === 1) {
          const firstPhoto = photos[0];
          let tempPath: string | undefined;
          try {
            void pushLiveProgress(20, 'downloading-image-from-telegram');
            const downloaded = await fetchTelegramFileToTemp(botToken, firstPhoto.fileId, firstPhoto.fileSize);
            tempPath = downloaded.tempPath;
            const result = await publishToFacebook({
              target,
              message: text,
              media: {
                kind: 'image',
                filePath: tempPath,
                mimeType: firstPhoto.mimeType || 'image/jpeg',
              },
              onProgress: ({ percent, stage }) => {
                void pushLiveProgress(percent, stage);
              },
            });
            responseData = {
              id: result.id,
              url: result.url,
              nodeId: result.nodeId,
            };
          } catch (error) {
            if (allowTextOnlyFallback && shouldFallbackToTextOnlyForTelegramMediaError(error, text)) {
              await publishTextOnlyFallback(getErrorMessage(error));
            } else {
              throw error;
            }
          } finally {
            await cleanupTempFile(tempPath);
          }
        } else {
          const result = await publishToFacebook({
            target,
            message: text,
            onProgress: ({ percent, stage }) => {
              void pushLiveProgress(percent, stage);
            },
          });
          responseData = {
            id: result.id,
            url: result.url,
            nodeId: result.nodeId,
          };
        }
        debugLog('Telegram -> Facebook publish success', {
          taskId: task.id,
          targetId: target.id,
          postId: responseData?.id,
        });
      } else {
        throw new Error(`Target platform not supported yet: ${target.platformId}`);
      }
    } catch (error) {
      status = 'failed';
      errorMessage = getErrorMessage(error) || 'Unknown error';
      debugError('Telegram webhook target failed', error, { taskId: task.id, targetId: target.id });
    }

    await progressWriteChain;
    await db.updateExecution(liveExecution.id, {
      transformedContent,
      status,
      error: errorMessage,
      executedAt: new Date(),
      responseData: {
        sourcePlatformId: account.platformId,
        targetPlatformId: target.platformId,
        ...(responseData || {}),
        progress: 100,
        stage: status === 'success' ? 'completed' : 'failed',
        failureReason: status === 'failed' ? errorMessage : undefined,
      },
    });
    return status === 'failed';
  }));

  failures += targetResults.reduce((count, result) => {
    if (result.status === 'fulfilled') {
      return count + (result.value ? 1 : 0);
    }
    return count + 1;
  }, 0);

  await db.updateTask(task.id, {
    executionCount: (task.executionCount ?? 0) + 1,
    failureCount: (task.failureCount ?? 0) + failures,
    lastExecuted: new Date(),
    lastError: failures > 0 ? 'One or more targets failed' : undefined,
  });
}

async function processTelegramMessages(context: TelegramProcessingContext): Promise<void> {
  const { account, botToken, triggerMessage } = context;
  const groupedMessages = normalizeMediaGroupMessages(context.groupedMessages);
  const chatId = context.chatId ?? triggerMessage.chat?.id?.toString();

  const configuredChatId = (account.credentials as any)?.chatId?.toString();
  if (configuredChatId && chatId && configuredChatId !== chatId) {
    debugLog('Telegram webhook ignored: chat mismatch', { configuredChatId, chatId });
    return;
  }

  const text = groupedMessages
    .map(extractMessageText)
    .find(value => value.trim().length > 0) || '';
  const mediaItems = groupedMessages
    .map(item => pickTelegramMedia(item))
    .filter((item): item is PickedTelegramMedia => Boolean(item));

  if (!text && mediaItems.length === 0) {
    debugLog('Telegram webhook ignored: no text/caption and no media', {
      messageId: triggerMessage.message_id,
      mediaGroupId: triggerMessage.media_group_id,
    });
    return;
  }
  if (!text && mediaItems.length > 0) {
    debugLog('Telegram webhook: media without caption', {
      messageId: triggerMessage.message_id,
      mediaGroupId: triggerMessage.media_group_id,
      mediaCount: mediaItems.length,
    });
  }
  debugLog('Telegram message accepted', {
    messageId: triggerMessage.message_id,
    chatId,
    grouped: groupedMessages.length > 1,
    groupedCount: groupedMessages.length,
    hasMedia: mediaItems.length > 0,
    mediaCount: mediaItems.length,
  });

  const userAccounts = await db.getUserAccounts(account.userId);
  const accountsById = new Map(userAccounts.map(a => [a.id, a]));

  const userTasks = await db.getUserTasks(account.userId);
  const activeTasks = userTasks.filter(
    (task) => {
      if (task.status !== 'active') return false;
      // Process only tasks that explicitly use this Telegram account as source
      // to avoid duplicate dispatch across unrelated Telegram source accounts.
      return task.sourceAccounts.includes(account.id);
    }
  );

  if (activeTasks.length === 0) {
    debugLog('Telegram webhook ignored: no active tasks', { accountId: account.id });
    return;
  }

  const taskDispatchKey = `${account.id}:${chatId || 'unknown_chat'}:${triggerMessage.message_id}:${triggerMessage.media_group_id || 'single'}`;
  const jobs = activeTasks.map((task) =>
    executionQueue.enqueue({
      label: 'telegram:webhook-task',
      userId: account.userId,
      taskId: task.id,
      dedupeKey: `telegram:webhook:task:${task.id}:${taskDispatchKey}`,
      run: async () =>
        processTelegramTask({
          account,
          botToken,
          task,
          accountsById,
          text,
          mediaItems,
        }),
    })
  );

  if (jobs.length > 0) {
    await Promise.allSettled(jobs);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botToken: string }> }
) {
  const { botToken } = await params;
  const normalizedBotToken = String(botToken || '').trim();
  if (!normalizedBotToken) {
    return NextResponse.json({ success: false, error: 'Missing bot token' }, { status: 400 });
  }
  debugLog('Telegram webhook received', { botTokenPrefix: normalizedBotToken.slice(0, 8) });

  const accounts = await db.getAllAccounts();
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  let account = accounts.find(
    (a) => a.platformId === 'telegram' && String(a.accessToken || '').trim() === normalizedBotToken
  );
  if (!account && secretHeader) {
    account = accounts.find(
      (a) =>
        a.platformId === 'telegram' &&
        String((a.credentials as any)?.webhookSecret || '') === secretHeader
    );
    if (account) {
      debugLog('Telegram webhook resolved account via webhook secret header', {
        accountId: account.id,
      });
    }
  }
  if (!account) {
    debugLog('Telegram webhook ignored: bot not found', {
      botTokenPrefix: normalizedBotToken.slice(0, 8),
      telegramAccounts: accounts.filter((a) => a.platformId === 'telegram').length,
      hasSecretHeader: Boolean(secretHeader),
    });
    // Return 200 to prevent Telegram from retrying unknown/stale bot URLs forever.
    return NextResponse.json({ success: true, ignored: true, reason: 'bot_not_found' }, { status: 200 });
  }
  if (!account.isActive) {
    debugLog('Telegram webhook ignored: bot inactive', { accountId: account.id });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }
  const effectiveBotToken = String(account.accessToken || '').trim();
  if (!effectiveBotToken) {
    debugLog('Telegram webhook ignored: active account has empty token', { accountId: account.id });
    return NextResponse.json({ success: false, error: 'Bot token not configured' }, { status: 500 });
  }
  if (effectiveBotToken !== normalizedBotToken) {
    debugLog('Telegram webhook token mismatch, using account token from database', {
      accountId: account.id,
      urlTokenPrefix: normalizedBotToken.slice(0, 8),
      accountTokenPrefix: effectiveBotToken.slice(0, 8),
    });
  }

  const expectedSecret = (account.credentials as any)?.webhookSecret;
  if (expectedSecret && secretHeader !== expectedSecret) {
    debugLog('Telegram webhook secret mismatch', {
      accountId: account.id,
      hasHeader: Boolean(secretHeader)
    });
    return NextResponse.json({ success: false, error: 'Invalid webhook secret' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    debugLog('Telegram webhook invalid payload');
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const numericUpdateId = Number(update.update_id);
  if (Number.isFinite(numericUpdateId)) {
    const isNewUpdate = await db.registerTelegramWebhookUpdate({
      accountId: account.id,
      updateId: numericUpdateId,
    });
    if (!isNewUpdate) {
      debugLog('Telegram webhook ignored: duplicate update', {
        accountId: account.id,
        updateId: numericUpdateId,
      });
      return NextResponse.json({ success: true, ignored: true, duplicate: true }, { status: 200 });
    }
    void db.cleanupTelegramWebhookUpdates().catch(() => undefined);
  }

  const message = extractMessage(update);
  if (!message) {
    debugLog('Telegram webhook ignored: no message');
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }
  debugLog('Telegram webhook update envelope', {
    hasMessage: Boolean(update.message),
    hasChannelPost: Boolean(update.channel_post),
    messageId: message.message_id,
    mediaGroupId: message.media_group_id,
  });

  const chatId = message.chat?.id?.toString();
  const configuredChatId = (account.credentials as any)?.chatId?.toString();
  if (configuredChatId && chatId && configuredChatId !== chatId) {
    debugLog('Telegram webhook ignored: chat mismatch', { configuredChatId, chatId });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  if (message.media_group_id) {
    const groupChatId = chatId || 'unknown_chat';
    const groupKey = buildMediaGroupKey(account.id, groupChatId, message.media_group_id);
    await db.addTelegramMediaGroupMessage({
      groupKey,
      accountId: account.id,
      chatId: groupChatId,
      mediaGroupId: message.media_group_id,
      messageId: message.message_id,
      payload: message as Record<string, any>,
    });

    scheduleTelegramMediaGroupFlush({
      groupKey,
      accountId: account.id,
      chatId: groupChatId,
      mediaGroupId: message.media_group_id,
      botToken: effectiveBotToken,
    });

    debugLog('Telegram media-group update buffered for deferred processing', {
      messageId: message.message_id,
      mediaGroupId: message.media_group_id,
      groupKey,
    });
    return NextResponse.json({ success: true, buffered: true }, { status: 200 });
  }

  const numericMessageId = Number(message.message_id);
  if (Number.isFinite(numericMessageId)) {
    const isNewMessage = await db.registerTelegramProcessedMessage({
      accountId: account.id,
      chatId: chatId || 'unknown_chat',
      messageId: numericMessageId,
    });
    if (!isNewMessage) {
      debugLog('Telegram webhook ignored: duplicate message', {
        accountId: account.id,
        chatId: chatId || 'unknown_chat',
        messageId: numericMessageId,
      });
      return NextResponse.json({ success: true, ignored: true, duplicate: true }, { status: 200 });
    }
    void db.cleanupTelegramProcessedMessages().catch(() => undefined);
  }

  const queuedDedupeKey = Number.isFinite(numericUpdateId)
    ? `telegram:update:${account.id}:${numericUpdateId}`
    : `telegram:message:${account.id}:${chatId || 'unknown_chat'}:${message.message_id}`;
  const queuedTaskKey = Number.isFinite(numericUpdateId)
    ? `telegram-account:${account.id}:update:${numericUpdateId}`
    : `telegram-account:${account.id}:message:${chatId || 'unknown_chat'}:${message.message_id}`;
  void executionQueue
    .enqueue({
      label: 'telegram:webhook-message',
      userId: account.userId,
      taskId: queuedTaskKey,
      dedupeKey: queuedDedupeKey,
      run: async () =>
        processTelegramMessages({
          account,
          botToken: effectiveBotToken,
          chatId,
          triggerMessage: message,
          groupedMessages: [message],
        }),
    })
    .catch((error) => {
      debugError('Telegram webhook queue processing failed', error, {
        accountId: account.id,
        messageId: message.message_id,
      });
    });

  return NextResponse.json({ success: true, queued: true }, { status: 200 });
}
