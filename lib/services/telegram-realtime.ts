import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { Api, TelegramClient as MtprotoTelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, type NewMessageEvent } from 'telegram/events/NewMessage';
import { Album, type AlbumEvent } from 'telegram/events/Album';
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

function parseApiId(): number {
  const raw = String(process.env.API_ID || process.env.TELEGRAM_API_ID || '').trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Missing API_ID/TELEGRAM_API_ID for Telegram real-time updates');
  }
  return Math.floor(parsed);
}

function parseApiHash(): string {
  const hash = String(process.env.API_HASH || process.env.TELEGRAM_API_HASH || '').trim();
  if (!hash) {
    throw new Error('Missing API_HASH/TELEGRAM_API_HASH for Telegram real-time updates');
  }
  return hash;
}

function parseRealtimeKeepaliveSeconds(): number {
  const raw = String(process.env.TELEGRAM_REALTIME_KEEPALIVE_SECONDS || '').trim();
  if (!raw) return 30;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  if (parsed <= 0) return 0;
  return Math.max(5, Math.min(300, Math.floor(parsed)));
}

const REALTIME_KEEPALIVE_SECONDS = parseRealtimeKeepaliveSeconds();

function resolveTelegramSession(account: PlatformAccount): string {
  const creds = (account.credentials as Record<string, unknown>) || {};
  return normalizeString(creds.sessionString) || normalizeString(account.accessToken);
}

function resolveTelegramSourceChats(account: PlatformAccount, task: Task): string[] {
  const creds = (account.credentials as Record<string, unknown>) || {};
  const filters = (task.filters as Record<string, unknown>) || {};
  const fromCreds = normalizeTelegramChatList(creds.chatId);
  if (fromCreds.length > 0) return fromCreds;
  const fromFiltersList = normalizeTelegramChatList((filters as any).telegramChatIds);
  if (fromFiltersList.length > 0) return fromFiltersList;
  return normalizeTelegramChatList(filters.telegramChatId);
}

function resolveTelegramTargetChats(account: PlatformAccount, task: Task): string[] {
  const creds = (account.credentials as Record<string, unknown>) || {};
  const transformations = (task.transformations as Record<string, unknown>) || {};
  const fromCreds = normalizeTelegramChatList((creds as any).chatId);
  if (fromCreds.length > 0) return fromCreds;
  const fromTransformationsList = normalizeTelegramChatList((transformations as any).telegramTargetChatIds);
  if (fromTransformationsList.length > 0) return fromTransformationsList;
  return normalizeTelegramChatList((transformations as any).telegramTargetChatId);
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

function extractTelegramAuthFailureCode(error: unknown): string | null {
  const message = getErrorMessage(error).toUpperCase();
  const known = [
    'AUTH_KEY_DUPLICATED',
    'AUTH_KEY_UNREGISTERED',
    'SESSION_REVOKED',
    'USER_DEACTIVATED',
    'USER_DEACTIVATED_BAN',
  ];
  for (const code of known) {
    if (message.includes(code)) return code;
  }
  return null;
}

function isTelegramReauthRequired(account: PlatformAccount): boolean {
  if (account.platformId !== 'telegram') return false;
  const creds = (account.credentials || {}) as Record<string, any>;
  return creds.reauthRequired === true;
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
  if (!document) return null;

  const mimeType = String(document.mimeType || '').trim();
  if (!mimeType) return null;

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
      debugLog('Twitter access token refreshed during Telegram realtime service', { targetId: target.id });
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
  await client.getMe();
  await client.invoke(new Api.updates.GetState()).catch((error) => {
    debugError('Telegram realtime getState failed after connect', error);
  });
  return client;
}

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

async function processTelegramTaskMessage(params: {
  task: Task;
  source: PlatformAccount;
  targets: PlatformAccount[];
  text: string;
  mediaItems: TelegramMediaItem[];
  sourceClient: MtprotoTelegramClient;
}): Promise<void> {
  const { task, source, targets, text, mediaItems, sourceClient } = params;
  const executionGroupId = `telegram-realtime:${task.id}:${source.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;
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
            debugLog('Telegram realtime -> Buffer media fallback to text-only', {
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
        debugError('Telegram realtime target failed', error, {
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

type SourceRuntime = {
  accountId: string;
  sessionString: string;
  sourceChats: string[];
  client: MtprotoTelegramClient;
  keepaliveTimer?: NodeJS.Timeout;
  onNewMessage: (event: NewMessageEvent) => void;
  onAlbum: (event: AlbumEvent) => void;
  newMessageBuilder: NewMessage;
  albumBuilder: Album;
};

function normalizeChatSet(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => String(value).trim()).filter(Boolean))].sort();
}

function sameChatSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let idx = 0; idx < a.length; idx += 1) {
    if (a[idx] !== b[idx]) return false;
  }
  return true;
}

export class TelegramRealtimeService {
  private sourceRuntimes = new Map<string, SourceRuntime>();
  private sourceChatsByAccountId = new Map<string, Set<string>>();
  private taskIdsBySourceAccountId = new Map<string, Set<string>>();
  private taskCacheById = new Map<string, Task>();
  private accountsById = new Map<string, PlatformAccount>();
  private refreshing: Promise<void> | null = null;

  async refresh() {
    if (this.refreshing) {
      return this.refreshing;
    }

    this.refreshing = this.doRefresh().finally(() => {
      this.refreshing = null;
    });

    return this.refreshing;
  }

  async stop() {
    const runtimes = [...this.sourceRuntimes.values()];
    this.sourceRuntimes.clear();
    for (const runtime of runtimes) {
      await this.stopRuntime(runtime);
    }
  }

  private async doRefresh() {
    const tasks = await db.getAllTasks();
    const allAccounts = await db.getAllAccounts();
    this.accountsById = new Map(allAccounts.map((account) => [account.id, account]));

    const activeTasks = tasks.filter((task) => task.status === 'active');
    const sourceChatsByAccountId = new Map<string, Set<string>>();
    const taskIdsBySourceAccountId = new Map<string, Set<string>>();
    const nextTaskCacheById = new Map<string, Task>();

    for (const task of activeTasks) {
      nextTaskCacheById.set(task.id, task);

      for (const sourceAccountId of task.sourceAccounts) {
        const sourceAccount = this.accountsById.get(sourceAccountId);
        if (!sourceAccount || sourceAccount.platformId !== 'telegram' || !sourceAccount.isActive) {
          continue;
        }
        if (isTelegramReauthRequired(sourceAccount)) {
          continue;
        }

        const sessionString = resolveTelegramSession(sourceAccount);
        if (!sessionString) {
          continue;
        }

        const sourceChatIds = resolveTelegramSourceChats(sourceAccount, task);
        if (sourceChatIds.length === 0) {
          continue;
        }

        const chats = sourceChatsByAccountId.get(sourceAccountId) || new Set<string>();
        for (const sourceChatId of sourceChatIds) {
          chats.add(sourceChatId);
        }
        sourceChatsByAccountId.set(sourceAccountId, chats);

        const taskIds = taskIdsBySourceAccountId.get(sourceAccountId) || new Set<string>();
        taskIds.add(task.id);
        taskIdsBySourceAccountId.set(sourceAccountId, taskIds);
      }
    }

    this.sourceChatsByAccountId = sourceChatsByAccountId;
    this.taskIdsBySourceAccountId = taskIdsBySourceAccountId;
    this.taskCacheById = nextTaskCacheById;

    const desiredSourceAccountIds = new Set(this.sourceChatsByAccountId.keys());

    for (const [accountId, runtime] of this.sourceRuntimes.entries()) {
      const account = this.accountsById.get(accountId);
      const expectedSession = account ? resolveTelegramSession(account) : '';
      const desiredChats = normalizeChatSet(this.sourceChatsByAccountId.get(accountId) || []);
      const shouldKeep =
        desiredSourceAccountIds.has(accountId) &&
        expectedSession &&
        expectedSession === runtime.sessionString &&
        sameChatSet(runtime.sourceChats, desiredChats);
      if (shouldKeep) continue;

      this.sourceRuntimes.delete(accountId);
      await this.stopRuntime(runtime);
    }

    for (const accountId of desiredSourceAccountIds) {
      if (this.sourceRuntimes.has(accountId)) {
        continue;
      }

      const account = this.accountsById.get(accountId);
      if (!account) continue;
      if (isTelegramReauthRequired(account)) continue;
      const sessionString = resolveTelegramSession(account);
      if (!sessionString) continue;

      const runtime = await this.startRuntime(account, sessionString);
      if (runtime) {
        this.sourceRuntimes.set(accountId, runtime);
      }
    }

    debugLog('Telegram realtime refresh complete', {
      activeSources: this.sourceRuntimes.size,
      activeTasks: this.taskCacheById.size,
    });
  }

  private async startRuntime(account: PlatformAccount, sessionString: string): Promise<SourceRuntime | null> {
    try {
      const client = await createSessionClient(sessionString);
      const sourceChats = normalizeChatSet(this.sourceChatsByAccountId.get(account.id) || []);
      const eventFilter = sourceChats.length > 0 ? { chats: sourceChats } : {};
      const newMessageBuilder = new NewMessage(eventFilter);
      const albumBuilder = new Album(eventFilter);

      const onNewMessage = (event: NewMessageEvent) => {
        void this.handleNewMessage(account.id, event).catch((error) => {
          debugError('Telegram realtime NewMessage handler failed', error, {
            accountId: account.id,
          });
        });
      };

      const onAlbum = (event: AlbumEvent) => {
        void this.handleAlbum(account.id, event).catch((error) => {
          debugError('Telegram realtime Album handler failed', error, {
            accountId: account.id,
          });
        });
      };

      client.addEventHandler(onNewMessage, newMessageBuilder);
      client.addEventHandler(onAlbum, albumBuilder);

      const keepaliveTimer =
        REALTIME_KEEPALIVE_SECONDS > 0
          ? setInterval(() => {
              void client.invoke(new Api.updates.GetState()).catch((error) => {
                const authCode = extractTelegramAuthFailureCode(error);
                if (authCode) {
                  debugError('Telegram realtime session requires re-auth; disabling account', error, {
                    accountId: account.id,
                    authCode,
                  });
                  void this.disableAccountForReauth(account.id, authCode);
                  return;
                }
                debugError('Telegram realtime keepalive failed', error, {
                  accountId: account.id,
                });
              });
            }, REALTIME_KEEPALIVE_SECONDS * 1000)
          : undefined;
      keepaliveTimer?.unref?.();

      debugLog('Telegram realtime source connected', {
        accountId: account.id,
        accountUsername: account.accountUsername,
        sourceChats,
        keepaliveSeconds: REALTIME_KEEPALIVE_SECONDS,
      });

      return {
        accountId: account.id,
        sessionString,
        sourceChats,
        client,
        keepaliveTimer,
        onNewMessage,
        onAlbum,
        newMessageBuilder,
        albumBuilder,
      };
    } catch (error) {
      const authCode = extractTelegramAuthFailureCode(error);
      if (authCode) {
        debugError('Telegram realtime connect failed; disabling account for re-auth', error, {
          accountId: account.id,
          authCode,
        });
        await this.disableAccountForReauth(account.id, authCode);
      }
      debugError('Failed to connect Telegram realtime source', error, {
        accountId: account.id,
      });
      return null;
    }
  }

  private async disableAccountForReauth(accountId: string, authCode: string) {
    const runtime = this.sourceRuntimes.get(accountId);
    if (runtime) {
      this.sourceRuntimes.delete(accountId);
      await this.stopRuntime(runtime);
    }

    const current = this.accountsById.get(accountId) || (await db.getAccount(accountId));
    if (!current) return;
    if (current.platformId !== 'telegram') return;

    const currentCreds = (current.credentials || {}) as Record<string, any>;
    const nextCreds: Record<string, any> = {
      ...currentCreds,
      reauthRequired: true,
      reauthReason: authCode,
      reauthRequiredAt: new Date().toISOString(),
    };

    const updated = await db.updateAccount(accountId, {
      isActive: false,
      credentials: nextCreds,
    });
    if (updated) {
      this.accountsById.set(accountId, updated);
    }
  }

  private async stopRuntime(runtime: SourceRuntime) {
    if (runtime.keepaliveTimer) {
      clearInterval(runtime.keepaliveTimer);
    }

    try {
      runtime.client.removeEventHandler(runtime.onNewMessage as any, runtime.newMessageBuilder as any);
    } catch {
      // ignore
    }

    try {
      runtime.client.removeEventHandler(runtime.onAlbum as any, runtime.albumBuilder as any);
    } catch {
      // ignore
    }

    await runtime.client.disconnect().catch(() => undefined);
    debugLog('Telegram realtime source disconnected', { accountId: runtime.accountId });
  }

  private async handleNewMessage(accountId: string, event: NewMessageEvent) {
    const runtime = this.sourceRuntimes.get(accountId);
    if (!runtime) return;

    const message = event.message;
    if (!message || !(message instanceof Api.Message)) return;

    // Albums are handled by AlbumEvent to avoid duplicate processing.
    if (message.groupedId) {
      return;
    }

    await this.processIncomingMessages({
      accountId,
      sourceClient: runtime.client,
      messages: [message],
      dispatchKey: `single:${message.id}`,
    });
  }

  private async handleAlbum(accountId: string, event: AlbumEvent) {
    const runtime = this.sourceRuntimes.get(accountId);
    if (!runtime) return;

    const messages = (event.messages || [])
      .filter((message): message is Api.Message => message instanceof Api.Message)
      .sort((a, b) => a.id - b.id);

    if (messages.length === 0) {
      return;
    }

    const groupedId = messages[0]?.groupedId?.toString() || 'unknown_group';

    await this.processIncomingMessages({
      accountId,
      sourceClient: runtime.client,
      messages,
      dispatchKey: `album:${groupedId}`,
    });
  }

  private async processIncomingMessages(params: {
    accountId: string;
    sourceClient: MtprotoTelegramClient;
    messages: Api.Message[];
    dispatchKey: string;
  }) {
    const { accountId, sourceClient, messages, dispatchKey } = params;
    if (messages.length === 0) return;

    const sourceChats = this.sourceChatsByAccountId.get(accountId);
    const sourceTaskIds = this.taskIdsBySourceAccountId.get(accountId);
    if (!sourceChats || sourceChats.size === 0 || !sourceTaskIds || sourceTaskIds.size === 0) {
      return;
    }

    const account = this.accountsById.get(accountId);
    if (!account || !account.isActive || account.platformId !== 'telegram') {
      return;
    }

    const chatId = String(messages[0]?.chatId || '').trim();
    if (!chatId || !sourceChats.has(chatId)) {
      return;
    }

    let hasNewMessage = false;
    for (const message of messages) {
      const isNew = await db.registerTelegramProcessedMessage({
        accountId,
        chatId: `realtime:${chatId}`,
        messageId: message.id,
      });
      hasNewMessage = hasNewMessage || isNew;
    }

    if (!hasNewMessage) {
      return;
    }

    const text = messages
      .map((message) => String(message.message || '').trim())
      .find((value) => value.length > 0) || '';

    const mediaItems = messages
      .map((message) => pickMessageMedia(message))
      .filter((item): item is TelegramMediaItem => Boolean(item));

    if (!text && mediaItems.length === 0) {
      return;
    }

    const targetsByTaskId = new Map<string, PlatformAccount[]>();
    for (const taskId of sourceTaskIds) {
      const task = this.taskCacheById.get(taskId);
      if (!task || task.status !== 'active') continue;
      if (!task.sourceAccounts.includes(accountId)) continue;
      if (!taskProcessor.applyFilters(text, task.filters)) continue;

      const targets = task.targetAccounts
        .map((targetId) => this.accountsById.get(targetId))
        .filter((target): target is PlatformAccount => Boolean(target))
        .filter((target) => target.isActive);

      if (targets.length === 0) continue;
      targetsByTaskId.set(task.id, targets);
    }

    const firstMessageId = messages[0]?.id || 0;
    const jobs: Array<Promise<unknown>> = [];

    for (const [taskId, targets] of targetsByTaskId.entries()) {
      const task = this.taskCacheById.get(taskId);
      if (!task) continue;

      jobs.push(
        executionQueue.enqueue({
          label: 'telegram:realtime-task',
          userId: task.userId,
          taskId: task.id,
          dedupeKey: `telegram:realtime:task:${task.id}:${accountId}:${chatId}:${dispatchKey}:${firstMessageId}`,
          run: async () =>
            processTelegramTaskMessage({
              task,
              source: account,
              targets,
              text,
              mediaItems,
              sourceClient,
            }),
        })
      );
    }

    if (jobs.length > 0) {
      await Promise.allSettled(jobs);
    }

    void db.cleanupTelegramProcessedMessages().catch(() => undefined);
  }
}

const globalKey = '__telegramRealtimeService__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new TelegramRealtimeService();
}

export const telegramRealtimeService: TelegramRealtimeService = g[globalKey];

export async function ensureTelegramRealtimeStarted() {
  if (String(process.env.TELEGRAM_REALTIME_ENABLED || 'true') === 'false') {
    await telegramRealtimeService.stop();
    return;
  }

  await telegramRealtimeService.refresh();
}
