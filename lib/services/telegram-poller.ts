import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { Api, TelegramClient as MtprotoTelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { db, type PlatformAccount, type Task } from '@/lib/db';
import { TelegramClient as BotTelegramClient } from '@/platforms/telegram/client';
import { TwitterClient, refreshTwitterToken } from '@/platforms/twitter/client';
import { executeYouTubePublish } from '@/lib/services/youtube-actions';
import { publishFacebookPhotoAlbum, publishToFacebook } from '@/lib/services/facebook-publish';
import { createVideoProgressLogger } from '@/lib/services/video-progress';
import { executionQueue } from '@/lib/services/execution-queue';
import { taskProcessor } from '@/lib/services/task-processor';
import { debugError, debugLog } from '@/lib/debug';
import { getOAuthClientCredentials } from '@/lib/platform-credentials';
import { getPlatformApiProviderForUser } from '@/lib/platforms/provider';
import { getPlatformHandlerForUser } from '@/lib/platforms/handlers';
import type { PlatformId, PostRequest } from '@/lib/platforms/types';
import {
  createBufferPublishTokenForAccount,
  getBufferUserSettings,
} from '@/lib/buffer-user-settings';

const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const MIN_POLL_INTERVAL_SECONDS = 5;
const MAX_POLL_INTERVAL_SECONDS = 300;
const DEFAULT_FETCH_LIMIT = 100;
const MIN_FETCH_LIMIT = 10;
const MAX_FETCH_LIMIT = 200;
const DEFAULT_ALBUM_QUIET_SECONDS = 3;
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

async function buildBufferPublishToken(target: PlatformAccount): Promise<string> {
  const settings = await getBufferUserSettings(target.userId);
  return createBufferPublishTokenForAccount({
    userId: target.userId,
    accessToken: settings.accessToken,
    baseUrl: settings.baseUrl,
    applyToAllAccounts: settings.applyToAllAccounts,
    account: target,
  });
}

function clampSeconds(value: number) {
  if (value < MIN_POLL_INTERVAL_SECONDS) return MIN_POLL_INTERVAL_SECONDS;
  if (value > MAX_POLL_INTERVAL_SECONDS) return MAX_POLL_INTERVAL_SECONDS;
  return value;
}

function clampFetchLimit(value: number) {
  if (value < MIN_FETCH_LIMIT) return MIN_FETCH_LIMIT;
  if (value > MAX_FETCH_LIMIT) return MAX_FETCH_LIMIT;
  return value;
}

function parseApiId(): number {
  const raw = String(process.env.API_ID || process.env.TELEGRAM_API_ID || '').trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Missing API_ID/TELEGRAM_API_ID for Telegram MTProto polling');
  }
  return Math.floor(parsed);
}

function parseApiHash(): string {
  const hash = String(process.env.API_HASH || process.env.TELEGRAM_API_HASH || '').trim();
  if (!hash) {
    throw new Error('Missing API_HASH/TELEGRAM_API_HASH for Telegram MTProto polling');
  }
  return hash;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTelegramChatList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeString(item)).filter(Boolean))];
  }
  const raw = normalizeString(value);
  if (!raw) return [];
  if (raw.includes(',') || raw.includes('\n')) {
    return [...new Set(raw.split(/[\n,]+/).map((item) => normalizeString(item)).filter(Boolean))];
  }
  return [raw];
}

function resolveTelegramSession(account: PlatformAccount): string {
  const creds = (account.credentials as Record<string, unknown>) || {};
  const fromCreds = normalizeString(creds.sessionString);
  const fromAccessToken = normalizeString(account.accessToken);
  return fromCreds || fromAccessToken;
}

function resolveTelegramSourceChats(account: PlatformAccount, task: Task): string[] {
  const creds = (account.credentials as Record<string, unknown>) || {};
  const filters = (task.filters as Record<string, unknown>) || {};

  const fromCreds = normalizeTelegramChatList(creds.chatId);
  if (fromCreds.length > 0) return fromCreds;

  const fromFiltersList = normalizeTelegramChatList((filters as any).telegramChatIds);
  if (fromFiltersList.length > 0) return fromFiltersList;

  const fromFiltersSingle = normalizeTelegramChatList(filters.telegramChatId);
  if (fromFiltersSingle.length > 0) return fromFiltersSingle;

  return [];
}

function resolveTelegramTargetChats(account: PlatformAccount, task: Task): string[] {
  const creds = (account.credentials as Record<string, unknown>) || {};
  const transformations = (task.transformations as Record<string, unknown>) || {};

  const fromCreds = normalizeTelegramChatList((creds as any).chatId);
  if (fromCreds.length > 0) return fromCreds;

  const fromTransformationsList = normalizeTelegramChatList((transformations as any).telegramTargetChatIds);
  if (fromTransformationsList.length > 0) return fromTransformationsList;

  // Optional task-level fallback. Used only if the target account has no chatId.
  const fromTransformationsSingle = normalizeTelegramChatList((transformations as any).telegramTargetChatId);
  if (fromTransformationsSingle.length > 0) return fromTransformationsSingle;

  return [];
}

function extensionFromMimeType(mimeType: string): string {
  const lower = String(mimeType || '').toLowerCase();
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
  if (lower.includes('png')) return '.png';
  if (lower.includes('webp')) return '.webp';
  if (lower.includes('gif')) return '.gif';
  if (lower.includes('quicktime')) return '.mov';
  if (lower.includes('webm')) return '.webm';
  if (lower.includes('mp4')) return '.mp4';
  if (lower.startsWith('image/')) return '.jpg';
  if (lower.startsWith('video/')) return '.mp4';
  return '.bin';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function isTwitterUnauthorizedError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('401') || message.includes('unauthorized');
}

function extractVideoDurationSec(document?: Api.Document): number | undefined {
  if (!document || !Array.isArray(document.attributes)) return undefined;
  for (const attribute of document.attributes) {
    if (attribute instanceof Api.DocumentAttributeVideo) {
      const duration = Number(attribute.duration);
      if (!Number.isFinite(duration) || duration <= 0) return undefined;
      return Math.max(1, Math.round(duration));
    }
  }
  return undefined;
}

function readText(message: Api.Message): string {
  return String(message.message || '').trim();
}

type TelegramMediaItem = {
  kind: 'photo' | 'video';
  mimeType: string;
  durationSec?: number;
  message: Api.Message;
};

function pickMessageMedia(message: Api.Message): TelegramMediaItem | null {
  if (message.photo) {
    return {
      kind: 'photo',
      mimeType: 'image/jpeg',
      message,
    };
  }

  const videoDocument = message.video;
  if (videoDocument) {
    return {
      kind: 'video',
      mimeType: String(videoDocument.mimeType || 'video/mp4'),
      durationSec: extractVideoDurationSec(videoDocument),
      message,
    };
  }

  const document = message.document;
  if (!document) {
    return null;
  }

  const mimeType = String(document.mimeType || '').trim();
  if (!mimeType) {
    return null;
  }

  if (mimeType.startsWith('image/')) {
    return {
      kind: 'photo',
      mimeType,
      message,
    };
  }

  if (mimeType.startsWith('video/')) {
    return {
      kind: 'video',
      mimeType,
      durationSec: extractVideoDurationSec(document),
      message,
    };
  }

  return null;
}

function parsePositiveIntEnv(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number {
  const parsed = Number(process.env[name] || '');
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  const min = options?.min ?? 1;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value && typeof value === 'object' && 'toJSNumber' in (value as any)) {
    try {
      const maybe = Number((value as any).toJSNumber());
      return Number.isFinite(maybe) ? maybe : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function resolveMaxDownloadBytes(): number {
  return parsePositiveIntEnv(
    'TELEGRAM_DOWNLOAD_MAX_BYTES',
    2 * 1024 * 1024 * 1024,
    { min: 20 * 1024 * 1024, max: 4 * 1024 * 1024 * 1024 }
  );
}

function resolvePartSizeKb(fileSizeBytes?: number): number {
  const override = Number(process.env.TELEGRAM_DOWNLOAD_PART_SIZE_KB || '');
  const clampPartSize = (value: number) => {
    const bounded = Math.max(4, Math.min(512, Math.floor(value)));
    // Telegram requires chunk size to be divisible by 4096 bytes -> 4KB steps.
    return Math.max(4, Math.floor(bounded / 4) * 4);
  };
  if (Number.isFinite(override) && override > 0) {
    return clampPartSize(override);
  }
  if (typeof fileSizeBytes === 'number' && Number.isFinite(fileSizeBytes) && fileSizeBytes >= 100 * 1024 * 1024) {
    return 512;
  }
  if (typeof fileSizeBytes === 'number' && Number.isFinite(fileSizeBytes) && fileSizeBytes >= 20 * 1024 * 1024) {
    return 256;
  }
  return 128;
}

function resolveDocumentFromMessage(message: Api.Message): Api.Document | undefined {
  if (message.video instanceof Api.Document) {
    return message.video;
  }
  if (message.document instanceof Api.Document) {
    return message.document;
  }
  return undefined;
}

function resolveMediaCacheKey(mediaItem: TelegramMediaItem): string {
  const document = resolveDocumentFromMessage(mediaItem.message);
  if (document?.id) {
    return `document:${document.id.toString()}`;
  }
  if (mediaItem.message.photo?.id) {
    return `photo:${mediaItem.message.photo.id.toString()}`;
  }
  return `message:${mediaItem.message.id}:${mediaItem.kind}:${mediaItem.mimeType}`;
}

async function cleanupTempFile(tempPath: string | undefined): Promise<void> {
  if (!tempPath) return;
  await fs.unlink(tempPath).catch(() => undefined);
}

async function downloadMediaToTemp(
  client: MtprotoTelegramClient,
  mediaItem: TelegramMediaItem
): Promise<{ tempPath: string; size: number }> {
  const extension = extensionFromMimeType(mediaItem.mimeType);
  const tempPath = `/tmp/telegram-media-${randomUUID()}${extension}`;
  const document = resolveDocumentFromMessage(mediaItem.message);
  const fileSizeBytes = toSafeNumber(document?.size);
  const maxDownloadBytes = resolveMaxDownloadBytes();

  try {
    if (typeof fileSizeBytes === 'number' && fileSizeBytes > maxDownloadBytes) {
      const maxMb = Math.round(maxDownloadBytes / (1024 * 1024));
      const fileMb = Math.round(fileSizeBytes / (1024 * 1024));
      throw new Error(
        `Telegram media exceeds configured limit (${fileMb}MB > ${maxMb}MB). ` +
        'Increase TELEGRAM_DOWNLOAD_MAX_BYTES if this is expected.'
      );
    }

    if (document) {
      await client.downloadFile(
        new Api.InputDocumentFileLocation({
          id: document.id,
          accessHash: document.accessHash,
          fileReference: document.fileReference,
          thumbSize: '',
        }),
        {
          outputFile: tempPath,
          fileSize: document.size,
          partSizeKb: resolvePartSizeKb(fileSizeBytes),
          dcId: document.dcId,
        }
      );
    } else {
      const output = await client.downloadMedia(mediaItem.message, {
        outputFile: tempPath,
      });

      if (Buffer.isBuffer(output)) {
        await fs.writeFile(tempPath, output);
      }
    }

    const stat = await fs.stat(tempPath);
    return { tempPath, size: stat.size };
  } catch (error) {
    await cleanupTempFile(tempPath);
    throw new Error(`Failed to download Telegram media: ${getErrorMessage(error)}`);
  }
}

function selectTwitterMediaForTweet(mediaItems: TelegramMediaItem[]): {
  selected: TelegramMediaItem[];
  droppedCount: number;
  mode: 'video_single' | 'photo_multi';
} {
  const firstVideo = mediaItems.find((item) => item.kind === 'video');
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

async function withTwitterClientRetry<T>(
  target: PlatformAccount,
  operation: (client: TwitterClient) => Promise<T>
): Promise<T> {
  let accessToken = String(target.accessToken || '').trim();
  let refreshToken = String(target.refreshToken || '').trim() || undefined;
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

      await db.updateAccount(target.id, {
        accessToken,
        refreshToken,
      });

      target.accessToken = accessToken;
      target.refreshToken = refreshToken;
      debugLog('Twitter access token refreshed during Telegram poller', { targetId: target.id });
    }
  }
}

async function createSessionClient(sessionString: string): Promise<MtprotoTelegramClient> {
  const apiId = parseApiId();
  const apiHash = parseApiHash();
  const connectionRetries = parsePositiveIntEnv('TELEGRAM_CONNECTION_RETRIES', 5, { min: 1, max: 50 });
  const requestRetries = parsePositiveIntEnv('TELEGRAM_REQUEST_RETRIES', 8, { min: 1, max: 30 });
  const downloadRetries = parsePositiveIntEnv('TELEGRAM_DOWNLOAD_RETRIES', 8, { min: 1, max: 30 });
  const floodSleepThreshold = parsePositiveIntEnv('TELEGRAM_FLOOD_SLEEP_THRESHOLD', 300, { min: 60, max: 3600 });
  const maxConcurrentDownloads = parsePositiveIntEnv('TELEGRAM_MAX_CONCURRENT_DOWNLOADS', 1, { min: 1, max: 4 });
  const client = new MtprotoTelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries,
    requestRetries,
    downloadRetries,
    floodSleepThreshold,
    maxConcurrentDownloads,
  });
  await client.connect();
  return client;
}

function normalizeChatKey(chatRef: string): string {
  return chatRef.trim().toLowerCase();
}

function collectGroupedMessages(messages: Api.Message[]): {
  singles: Api.Message[];
  groups: Map<string, Api.Message[]>;
} {
  const singles: Api.Message[] = [];
  const groups = new Map<string, Api.Message[]>();

  for (const message of messages) {
    const groupedId = message.groupedId ? message.groupedId.toString() : '';
    if (!groupedId) {
      singles.push(message);
      continue;
    }

    const list = groups.get(groupedId) || [];
    list.push(message);
    groups.set(groupedId, list);
  }

  for (const list of groups.values()) {
    list.sort((a, b) => a.id - b.id);
  }

  return { singles, groups };
}

function shouldDelayGroupedProcessing(messages: Api.Message[]): boolean {
  const quietSecondsRaw = Number(process.env.TELEGRAM_ALBUM_QUIET_SECONDS || DEFAULT_ALBUM_QUIET_SECONDS);
  const quietSeconds = Number.isFinite(quietSecondsRaw) ? Math.max(1, quietSecondsRaw) : DEFAULT_ALBUM_QUIET_SECONDS;
  const newestDateSec = messages.reduce((max, item) => Math.max(max, Number(item.date || 0)), 0);
  if (!newestDateSec) {
    return false;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - newestDateSec;
  return ageSeconds < quietSeconds;
}

type DispatchContext = {
  task: Task;
  source: PlatformAccount;
  targets: PlatformAccount[];
  text: string;
  mediaItems: TelegramMediaItem[];
  sourceClient: MtprotoTelegramClient;
};

async function dedupeBufferTargets(targets: PlatformAccount[]): Promise<PlatformAccount[]> {
  const selected: PlatformAccount[] = [];
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

async function processTelegramTaskMessage({
  task,
  source,
  targets,
  text,
  mediaItems,
  sourceClient,
}: DispatchContext): Promise<void> {
  const executionGroupId = `telegram-poller:${task.id}:${source.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;
  let failures = 0;
  const cachedDownloads = new Map<string, Promise<{ tempPath: string; size: number }>>();
  const cachedTempPaths = new Set<string>();

  const getDownloadedMedia = async (mediaItem: TelegramMediaItem): Promise<{ tempPath: string; size: number }> => {
    const cacheKey = resolveMediaCacheKey(mediaItem);
    const existing = cachedDownloads.get(cacheKey);
    if (existing) {
      return existing;
    }

    const next = downloadMediaToTemp(sourceClient, mediaItem)
      .then((result) => {
        cachedTempPaths.add(result.tempPath);
        return result;
      })
      .catch((error) => {
        cachedDownloads.delete(cacheKey);
        throw error;
      });
    cachedDownloads.set(cacheKey, next);
    return next;
  };

  try {
    const normalizedTargets = await dedupeBufferTargets(targets);
    const targetResults = await Promise.allSettled(normalizedTargets.map(async (target) => {
      let status: 'success' | 'failed' = 'success';
      let errorMessage: string | undefined;
      let responseData: Record<string, any> | undefined;
      const transformedContent = text;
      const liveExecution = await db.createExecution({
        taskId: task.id,
        sourceAccount: source.id,
        targetAccount: target.id,
        originalContent: text,
        transformedContent,
        status: 'pending',
        executedAt: new Date(),
        responseData: {
          sourcePlatformId: source.platformId,
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
                sourcePlatformId: source.platformId,
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
            sourcePlatformId: source.platformId,
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
          if (mediaItems.length > 0) {
            debugLog('Telegram poller -> Buffer media fallback to text-only', {
              taskId: task.id,
              sourceId: source.id,
              targetId: target.id,
              mediaCount: mediaItems.length,
            });
          }
          const handler = await getPlatformHandlerForUser(target.userId, managedTargetPlatformId);
          const postRequest: PostRequest = { content: text };
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
          responseData = await withTwitterClientRetry(target, async (twitterClient) => {
            const mediaPlan = selectTwitterMediaForTweet(mediaItems);
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
            for (let idx = 0; idx < mediaPlan.selected.length; idx += 1) {
              const media = mediaPlan.selected[idx];
              void pushLiveProgress(
                Math.round((progressStep / totalProgressSteps) * 100),
                `downloading-${media.kind}-from-telegram`
              );
              const downloaded = await getDownloadedMedia(media);

              progressStep += 1;
              progress(progressStep, totalProgressSteps, `${media.kind}-downloaded-from-telegram`, {
                mediaIndex: idx + 1,
                mediaTotal: mediaPlan.selected.length,
                mediaKind: media.kind,
                size: downloaded.size,
              });

              const uploadWindowStartPercent = Math.round((progressStep / totalProgressSteps) * 100);
              const uploadWindowEndPercent = Math.round(((progressStep + 1) / totalProgressSteps) * 100);

              const mediaId = await twitterClient.uploadMediaFromFile(downloaded.tempPath, media.mimeType, {
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

            const result = await twitterClient.tweet({
              text,
              media: uploadedMedia,
            });

            progress(totalProgressSteps, totalProgressSteps, 'tweet-posted', {
              tweetId: result.id,
              mediaTotal: uploadedMedia.length,
            });

            return {
              id: result.id,
              mediaIds: uploadedMedia.map((item) => item.mediaKey),
              uploadedMediaCount: uploadedMedia.length,
              droppedMediaCount: mediaPlan.droppedCount,
            };
          });
        } else if (target.platformId === 'telegram') {
          const targetChatIds = resolveTelegramTargetChats(target, task);
          if (targetChatIds.length === 0) {
            throw new Error('Missing Telegram target chat ID');
          }

          const sessionString = resolveTelegramSession(target);
          const isUserSession = normalizeString((target.credentials as any)?.authType) === 'user_session' && Boolean(sessionString);

          if (isUserSession) {
            const targetClient = await createSessionClient(sessionString);
            try {
              const messageIds: Array<string | number> = [];
              for (const targetChatId of targetChatIds) {
                const message = await targetClient.sendMessage(targetChatId, {
                  message: text,
                });
                messageIds.push(message.id);
              }
              responseData = { messageIds, messageId: messageIds[0] };
            } finally {
              await targetClient.disconnect().catch(() => undefined);
            }
          } else {
            const botClient = new BotTelegramClient(String(target.accessToken || '').trim());
            const messageIds: Array<string | number> = [];
            for (const targetChatId of targetChatIds) {
              const message = await botClient.sendMessage(targetChatId, text);
              messageIds.push(message.messageId);
            }
            responseData = { messageIds, messageId: messageIds[0] };
          }
        } else if (target.platformId === 'youtube') {
          const videos = mediaItems.filter((item) => item.kind === 'video');
          const firstVideo = videos[0];

          if (firstVideo) {
            void pushLiveProgress(20, 'downloading-video-from-telegram');
            const downloaded = await getDownloadedMedia(firstVideo);
            const result = await executeYouTubePublish({
              target,
              filePath: downloaded.tempPath,
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
          } else {
            throw new Error(
              'YouTube targets accept video uploads only. Skipping non-video content.'
            );
          }
        } else if (target.platformId === 'facebook') {
          const videos = mediaItems.filter((item) => item.kind === 'video');
          const photos = mediaItems.filter((item) => item.kind === 'photo');

          if (videos.length === 0 && photos.length > 1) {
            const selectedPhotos = photos.slice(0, 10);
            const albumPhotos: Array<{ filePath: string; mimeType?: string }> = [];
            for (const photo of selectedPhotos) {
              void pushLiveProgress(22, 'downloading-image-from-telegram');
              const downloaded = await getDownloadedMedia(photo);
              albumPhotos.push({
                filePath: downloaded.tempPath,
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
          } else if (videos.length > 0) {
            const firstVideo = videos[0];
            void pushLiveProgress(20, 'downloading-video-from-telegram');
            const downloaded = await getDownloadedMedia(firstVideo);
            const result = await publishToFacebook({
              target,
              message: text,
              media: {
                kind: 'video',
                filePath: downloaded.tempPath,
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
          } else if (photos.length === 1) {
            const firstPhoto = photos[0];
            void pushLiveProgress(20, 'downloading-image-from-telegram');
            const downloaded = await getDownloadedMedia(firstPhoto);
            const result = await publishToFacebook({
              target,
              message: text,
              media: {
                kind: 'image',
                filePath: downloaded.tempPath,
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
        } else {
          throw new Error(`Target platform not supported yet: ${target.platformId}`);
        }
      } catch (error) {
        status = 'failed';
        errorMessage = getErrorMessage(error);
        debugError('Telegram poller target failed', error, {
          taskId: task.id,
          sourceId: source.id,
          targetId: target.id,
        });
      }

      await progressWriteChain;
      await db.updateExecution(liveExecution.id, {
        transformedContent,
        status,
        error: errorMessage,
        executedAt: new Date(),
        responseData: {
          sourcePlatformId: source.platformId,
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
  } finally {
    await Promise.all([...cachedTempPaths].map((tempPath) => cleanupTempFile(tempPath)));
  }

  if (targets.length > 0) {
    await db.updateTask(task.id, {
      executionCount: (task.executionCount ?? 0) + 1,
      failureCount: (task.failureCount ?? 0) + failures,
      lastExecuted: new Date(),
      lastError: failures > 0 ? 'One or more targets failed' : undefined,
    });
  }
}

function isApiMessage(input: Api.TypeMessage): input is Api.Message {
  return input instanceof Api.Message;
}

export class TelegramPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;
  private lastPolledAtByTask = new Map<string, number>();

  start() {
    if (this.intervalId) return;

    const scheduleNext = async () => {
      try {
        await this.tick();
      } catch (error) {
        console.error('[TelegramPoller] Tick failed:', error);
      } finally {
        const nextMs = await this.computeNextIntervalMs();
        this.intervalId = setTimeout(scheduleNext, nextMs);
      }
    };

    scheduleNext().catch((error) => console.error('[TelegramPoller] Start failed:', error));
    console.log('[TelegramPoller] Started (dynamic interval)');
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }
    this.intervalId = null;
  }

  async runOnce() {
    await this.tick();
  }

  private shouldTaskPollNow(task: Task): boolean {
    const filters = (task.filters as Record<string, unknown>) || {};
    const pollIntervalSeconds = Number(filters.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS);
    const intervalMs = clampSeconds(Number.isFinite(pollIntervalSeconds) ? pollIntervalSeconds : DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
    const now = Date.now();
    const lastAt = this.lastPolledAtByTask.get(task.id) || 0;

    if (now - lastAt < intervalMs) {
      return false;
    }

    this.lastPolledAtByTask.set(task.id, now);
    return true;
  }

  private async processTask(task: Task): Promise<void> {
    if (!this.shouldTaskPollNow(task)) return;

    const sourceAccounts = (
      await Promise.all(task.sourceAccounts.map((id) => db.getAccount(id)))
    ).filter(Boolean) as PlatformAccount[];

    const targetAccounts = (
      await Promise.all(task.targetAccounts.map((id) => db.getAccount(id)))
    ).filter(Boolean) as PlatformAccount[];

    const telegramSources = sourceAccounts.filter((account) => {
      if (account.platformId !== 'telegram' || !account.isActive) return false;
      return Boolean(resolveTelegramSession(account));
    });

    const activeTargets = targetAccounts.filter((target) => target.isActive);
    if (telegramSources.length === 0 || activeTargets.length === 0) {
      return;
    }

    const fetchLimitRaw = Number(process.env.TELEGRAM_POLL_FETCH_LIMIT || DEFAULT_FETCH_LIMIT);
    const fetchLimit = clampFetchLimit(Number.isFinite(fetchLimitRaw) ? fetchLimitRaw : DEFAULT_FETCH_LIMIT);

    for (const source of telegramSources) {
      const sessionString = resolveTelegramSession(source);
      const sourceChats = resolveTelegramSourceChats(source, task);
      if (sourceChats.length === 0) {
        debugLog('Telegram poller skipped source without chatId', { taskId: task.id, sourceId: source.id });
        continue;
      }

      let sourceClient: MtprotoTelegramClient | null = null;
      try {
        sourceClient = await createSessionClient(sessionString);
        for (const sourceChat of sourceChats) {
          const messages = await sourceClient.getMessages(sourceChat, {
            limit: fetchLimit,
          });

          const sorted = messages
            .filter(isApiMessage)
            .filter((message) => Number.isFinite(message.id) && message.id > 0)
            .sort((a, b) => a.id - b.id);

          if (sorted.length === 0) {
            continue;
          }

          const { singles, groups } = collectGroupedMessages(sorted);
          const chatKey = `task:${task.id}:${normalizeChatKey(sourceChat)}`;

          for (const single of singles) {
            const isNew = await db.registerTelegramProcessedMessage({
              accountId: source.id,
              chatId: chatKey,
              messageId: single.id,
            });
            if (!isNew) continue;

            const text = readText(single);
            const media = pickMessageMedia(single);
            const mediaItems = media ? [media] : [];

            if (!text && mediaItems.length === 0) {
              continue;
            }

            if (!taskProcessor.applyFilters(text, task.filters)) {
              continue;
            }

            await processTelegramTaskMessage({
              task,
              source,
              targets: activeTargets,
              text,
              mediaItems,
              sourceClient,
            });
          }

          for (const [groupedId, groupMessages] of groups.entries()) {
            if (groupMessages.length === 0) continue;
            if (shouldDelayGroupedProcessing(groupMessages)) {
              debugLog('Telegram album delayed until quiet window passes', {
                taskId: task.id,
                sourceId: source.id,
                groupedId,
                count: groupMessages.length,
              });
              continue;
            }

            let hasNewMessage = false;
            for (const message of groupMessages) {
              const isNew = await db.registerTelegramProcessedMessage({
                accountId: source.id,
                chatId: chatKey,
                messageId: message.id,
              });
              hasNewMessage = hasNewMessage || isNew;
            }

            if (!hasNewMessage) {
              continue;
            }

            const text = groupMessages
              .map((message) => readText(message))
              .find((value) => value.length > 0) || '';

            const mediaItems = groupMessages
              .map((message) => pickMessageMedia(message))
              .filter((item): item is TelegramMediaItem => Boolean(item));

            if (!text && mediaItems.length === 0) {
              continue;
            }

            if (!taskProcessor.applyFilters(text, task.filters)) {
              continue;
            }

            debugLog('Telegram poller processing album', {
              taskId: task.id,
              sourceId: source.id,
              groupedId,
              count: groupMessages.length,
              mediaCount: mediaItems.length,
            });

            await processTelegramTaskMessage({
              task,
              source,
              targets: activeTargets,
              text,
              mediaItems,
              sourceClient,
            });
          }
        }
      } catch (error) {
        debugError('Telegram poller source processing failed', error, {
          taskId: task.id,
          sourceId: source.id,
          sourceChats,
        });
      } finally {
        await sourceClient?.disconnect().catch(() => undefined);
      }
    }
  }

  private async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const tasks = await db.getAllTasks();
      const accounts = await db.getAllAccounts();
      const byId = new Map(accounts.map((account) => [account.id, account]));

      const activeTelegramTasks = tasks.filter((task) => taskNeedsTelegramPolling(task, byId));
      if (activeTelegramTasks.length === 0) {
        return;
      }

      debugLog('Telegram poller tick', { tasks: activeTelegramTasks.length });

      const jobs = activeTelegramTasks.map((task) =>
        executionQueue.enqueue({
          label: 'telegram:poller-task',
          userId: task.userId,
          taskId: task.id,
          dedupeKey: `telegram:poller:${task.id}`,
          run: async () => this.processTask(task),
        })
      );

      await Promise.allSettled(jobs);
      void db.cleanupTelegramProcessedMessages().catch(() => undefined);
    } finally {
      this.running = false;
    }
  }

  private async computeNextIntervalMs(): Promise<number> {
    try {
      const tasks = await db.getAllTasks();
      const active = tasks.filter((task) => task.status === 'active');
      if (active.length === 0) {
        return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
      }

      const values = active
        .map((task) => Number((task.filters as Record<string, unknown> | undefined)?.pollIntervalSeconds || 0))
        .filter((value) => Number.isFinite(value) && value > 0);

      const minValue = values.length > 0 ? Math.min(...values) : DEFAULT_POLL_INTERVAL_SECONDS;
      return clampSeconds(minValue) * 1000;
    } catch (error) {
      console.error('[TelegramPoller] Failed to compute next interval:', error);
      return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
    }
  }
}

function taskNeedsTelegramPolling(task: Task, accountsById: Map<string, PlatformAccount>): boolean {
  if (task.status !== 'active') return false;
  if (!Array.isArray(task.sourceAccounts) || task.sourceAccounts.length === 0) return false;
  if (!Array.isArray(task.targetAccounts) || task.targetAccounts.length === 0) return false;

  return task.sourceAccounts
    .map((id) => accountsById.get(id))
    .some((account) => {
      if (!account) return false;
      if (account.platformId !== 'telegram' || !account.isActive) return false;

      const session = resolveTelegramSession(account);
      if (!session) return false;

      const chatsFromAccount = normalizeTelegramChatList((account.credentials as any)?.chatId);
      if (chatsFromAccount.length > 0) return true;

      const fallbackFilters = (task.filters as Record<string, unknown>) || {};
      const chatsFromTask =
        normalizeTelegramChatList((fallbackFilters as any).telegramChatIds).length > 0 ||
        normalizeTelegramChatList((fallbackFilters as any).telegramChatId).length > 0;
      return chatsFromTask;
    });
}

const globalKey = '__telegramPoller__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new TelegramPoller();
}

export const telegramPoller: TelegramPoller = g[globalKey];

export async function ensureTelegramPollingStarted() {
  if (String(process.env.TELEGRAM_POLLING_ENABLED || 'true') === 'false') {
    telegramPoller.stop();
    return;
  }

  try {
    const tasks = await db.getAllTasks();
    const accounts = await db.getAllAccounts();
    const byId = new Map(accounts.map((account) => [account.id, account]));

    const shouldStart = tasks.some((task) => taskNeedsTelegramPolling(task, byId));
    if (shouldStart) {
      telegramPoller.start();
    } else {
      telegramPoller.stop();
    }
  } catch (error) {
    console.error('[TelegramPoller] Failed to decide start/stop:', error);
    telegramPoller.start();
  }
}
