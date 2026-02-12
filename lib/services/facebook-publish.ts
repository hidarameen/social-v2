import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { open, readFile, stat, unlink } from 'fs/promises';
import { basename } from 'path';
import type { PlatformAccount } from '@/lib/db';
import { createVideoProgressLogger } from '@/lib/services/video-progress';

const FACEBOOK_GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';
const FACEBOOK_GRAPH_VIDEO_API_BASE = 'https://graph-video.facebook.com/v22.0';

export type FacebookPublishMedia = {
  kind: 'image' | 'video';
  filePath?: string;
  url?: string;
  mimeType?: string;
};

export type FacebookAlbumMedia = {
  filePath?: string;
  url?: string;
  mimeType?: string;
};

export type FacebookPublishInput = {
  target: PlatformAccount;
  message?: string;
  link?: string;
  media?: FacebookPublishMedia;
  scheduledPublishAt?: Date;
};

export type FacebookPublishResult = {
  id: string;
  url: string;
  nodeId: string;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveTargetNodeId(target: PlatformAccount): string {
  const pageId = cleanString((target.credentials as any)?.pageId);
  const accountId = cleanString(target.accountId);
  return pageId || accountId || 'me';
}

function resolveAccessToken(target: PlatformAccount): string {
  const tokenFromCredentials = cleanString((target.credentials as any)?.pageAccessToken);
  const tokenFromAccount = cleanString(target.accessToken);
  return tokenFromCredentials || tokenFromAccount;
}

function extensionToMimeType(filePath: string, fallback: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.webm')) return 'video/webm';
  return fallback;
}

function formatFacebookError(status: number, statusText: string, payload: any, fallbackText: string): string {
  const apiError = payload?.error;
  if (!apiError || typeof apiError !== 'object') {
    return `Facebook API error: ${status} ${statusText || fallbackText}`;
  }

  const baseMessage = cleanString(apiError.message) || `${status} ${statusText || fallbackText}`;
  const code = apiError.code;
  const subcode = apiError.error_subcode;
  const type = cleanString(apiError.type);
  const details = [
    type ? `type=${type}` : '',
    typeof code === 'number' ? `code=${code}` : '',
    typeof subcode === 'number' ? `subcode=${subcode}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  if (code === 190) {
    return `Facebook token is invalid or expired. Reconnect the Facebook account. (${baseMessage}${details ? ` | ${details}` : ''})`;
  }
  if (code === 200 || code === 10) {
    return `Facebook permissions are missing for this page/token. Ensure pages_manage_posts is approved. (${baseMessage}${details ? ` | ${details}` : ''})`;
  }
  return `Facebook API error: ${baseMessage}${details ? ` | ${details}` : ''}`;
}

async function graphJsonRequest(
  path: string,
  payload: URLSearchParams,
  options?: { baseUrl?: string }
): Promise<any> {
  const response = await fetch(`${options?.baseUrl || FACEBOOK_GRAPH_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(formatFacebookError(response.status, response.statusText, data, text || 'Bad Request'));
  }
  if (data?.error) {
    throw new Error(formatFacebookError(response.status, response.statusText, data, text || 'Bad Request'));
  }
  return data;
}

async function graphMultipartRequest(
  path: string,
  payload: FormData,
  options?: { baseUrl?: string }
): Promise<any> {
  const response = await fetch(`${options?.baseUrl || FACEBOOK_GRAPH_API_BASE}${path}`, {
    method: 'POST',
    body: payload,
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(formatFacebookError(response.status, response.statusText, data, text || 'Bad Request'));
  }
  if (data?.error) {
    throw new Error(formatFacebookError(response.status, response.statusText, data, text || 'Bad Request'));
  }
  return data;
}

function buildPublishedPayload(form: URLSearchParams | FormData, when?: Date): void {
  if (!when) return;
  const epochSeconds = Math.floor(when.getTime() / 1000);
  if (Number.isFinite(epochSeconds) && epochSeconds > 0) {
    form.append('published', 'false');
    form.append('scheduled_publish_time', String(epochSeconds));
  }
}

function resolveResultUrl(nodeId: string, objectId: string): string {
  if (objectId.includes('_')) {
    return `https://www.facebook.com/${objectId}`;
  }
  if (nodeId && nodeId !== 'me') {
    return `https://www.facebook.com/${nodeId}/posts/${objectId}`;
  }
  return `https://www.facebook.com/${objectId}`;
}

function isUnsupportedFacebookVideoFormatError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  return (
    lower.includes('code=352') ||
    lower.includes('subcode=1363024') ||
    lower.includes("video file you selected is in a format that we don't support")
  );
}

function isFacebookPayloadTooLargeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  return lower.includes('413') || lower.includes('request entity too large');
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

async function transcodeVideoToFacebookCompatibleMp4(inputPath: string): Promise<string> {
  const ffmpegPath = (process.env.FFMPEG_PATH || 'ffmpeg').trim() || 'ffmpeg';
  const outputPath = `/tmp/facebook-video-${randomUUID()}.mp4`;
  const crf = String(process.env.FACEBOOK_VIDEO_TRANSCODE_CRF || '23');
  const preset = String(process.env.FACEBOOK_VIDEO_TRANSCODE_PRESET || 'veryfast');

  const args = [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    crf,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ac',
    '2',
    '-ar',
    '48000',
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });
    child.on('error', (error) => {
      reject(
        new Error(
          `Failed to run ffmpeg for Facebook video transcode. Install ffmpeg or set FFMPEG_PATH. ${error.message}`
        )
      );
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg transcode failed (exit=${code}). ${stderr.trim()}`));
    });
  });

  return outputPath;
}

async function uploadFacebookVideoFromFile(params: {
  nodeId: string;
  accessToken: string;
  filePath: string;
  mimeType: string;
  message?: string;
  link?: string;
  scheduledPublishAt?: Date;
}): Promise<any> {
  const body = new FormData();
  const bytes = await readFile(params.filePath);
  body.append('access_token', params.accessToken);
  if (params.message) body.append('description', params.message);
  if (params.link) body.append('link', params.link);
  buildPublishedPayload(body, params.scheduledPublishAt);
  body.append(
    'source',
    new Blob([bytes], { type: params.mimeType }),
    basename(params.filePath)
  );
  return graphMultipartRequest(
    `/${encodeURIComponent(params.nodeId)}/videos`,
    body,
    { baseUrl: FACEBOOK_GRAPH_VIDEO_API_BASE }
  );
}

async function uploadFacebookVideoFromFileResumable(params: {
  nodeId: string;
  accessToken: string;
  filePath: string;
  fileSizeBytes: number;
  message?: string;
  link?: string;
  scheduledPublishAt?: Date;
  progress?: ReturnType<typeof createVideoProgressLogger>;
}): Promise<any> {
  const {
    nodeId,
    accessToken,
    filePath,
    fileSizeBytes,
    message,
    link,
    scheduledPublishAt,
    progress,
  } = params;

  const startPayload = new URLSearchParams();
  startPayload.set('access_token', accessToken);
  startPayload.set('upload_phase', 'start');
  startPayload.set('file_size', String(fileSizeBytes));
  const startData = await graphJsonRequest(
    `/${encodeURIComponent(nodeId)}/videos`,
    startPayload,
    { baseUrl: FACEBOOK_GRAPH_VIDEO_API_BASE }
  );

  const uploadSessionId = cleanString(startData?.upload_session_id);
  const videoId = cleanString(startData?.video_id);
  let startOffset = cleanString(startData?.start_offset);
  let endOffset = cleanString(startData?.end_offset);

  if (!uploadSessionId) {
    throw new Error('Facebook resumable upload failed: missing upload_session_id');
  }

  const fh = await open(filePath, 'r');
  let transferredBytes = 0;
  try {
    while (startOffset !== endOffset) {
      const startNum = Number(startOffset);
      const endNum = Number(endOffset);
      if (!Number.isFinite(startNum) || !Number.isFinite(endNum) || endNum < startNum) {
        throw new Error(
          `Facebook resumable upload returned invalid offsets: start=${startOffset}, end=${endOffset}`
        );
      }
      const chunkSize = endNum - startNum;
      if (chunkSize <= 0) break;

      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await fh.read(buffer, 0, chunkSize, startNum);
      if (bytesRead <= 0) {
        throw new Error('Facebook resumable upload could not read next file chunk');
      }
      const chunk = bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead);

      const transferForm = new FormData();
      transferForm.append('access_token', accessToken);
      transferForm.append('upload_phase', 'transfer');
      transferForm.append('upload_session_id', uploadSessionId);
      transferForm.append('start_offset', startOffset);
      transferForm.append('video_file_chunk', new Blob([chunk]), 'chunk.bin');

      const transferData = await graphMultipartRequest(
        `/${encodeURIComponent(nodeId)}/videos`,
        transferForm,
        { baseUrl: FACEBOOK_GRAPH_VIDEO_API_BASE }
      );
      const nextStart = cleanString(transferData?.start_offset);
      const nextEnd = cleanString(transferData?.end_offset);
      if (!nextStart || !nextEnd) {
        throw new Error('Facebook resumable upload failed: missing next offsets');
      }

      transferredBytes = Number(nextStart);
      startOffset = nextStart;
      endOffset = nextEnd;
      if (progress) {
        progress(
          Math.min(transferredBytes, fileSizeBytes),
          fileSizeBytes,
          'video-resumable-transfer',
          {
            bytesTransferred: transferredBytes,
            fileSizeBytes,
            transferredReadable: formatBytes(transferredBytes),
            fileSizeReadable: formatBytes(fileSizeBytes),
          }
        );
      }
    }
  } finally {
    await fh.close().catch(() => undefined);
  }

  const finishPayload = new URLSearchParams();
  finishPayload.set('access_token', accessToken);
  finishPayload.set('upload_phase', 'finish');
  finishPayload.set('upload_session_id', uploadSessionId);
  if (message) finishPayload.set('description', message);
  if (link) finishPayload.set('link', link);
  buildPublishedPayload(finishPayload, scheduledPublishAt);
  const finishData = await graphJsonRequest(
    `/${encodeURIComponent(nodeId)}/videos`,
    finishPayload,
    { baseUrl: FACEBOOK_GRAPH_VIDEO_API_BASE }
  );

  if (progress) {
    progress(fileSizeBytes, fileSizeBytes, 'video-resumable-finish', {
      videoId: cleanString(finishData?.video_id) || videoId || undefined,
    });
  }

  if (videoId && !finishData?.id && !finishData?.post_id && !finishData?.video_id) {
    return { ...finishData, id: videoId };
  }
  return finishData;
}

export async function publishToFacebook(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  const nodeId = resolveTargetNodeId(input.target);
  const accessToken = resolveAccessToken(input.target);
  if (!accessToken) {
    throw new Error('Facebook target is missing a page access token');
  }

  const progress = createVideoProgressLogger({
    flow: 'video-to-facebook',
    platform: 'facebook',
    targetId: input.target.id,
  });
  const message = cleanString(input.message);
  const media = input.media;

  let result: any;
  if (media?.kind === 'image') {
    progress(1, 4, 'prepare-image');
    if (media.filePath) {
      const fileSizeBytes = await stat(media.filePath).then(s => s.size).catch(() => undefined);
      progress(2, 4, 'image-upload-start', { fileSizeBytes });
      const bytes = await readFile(media.filePath);
      const mimeType = extensionToMimeType(media.filePath, media.mimeType || 'image/jpeg');
      const body = new FormData();
      body.append('access_token', accessToken);
      if (message) body.append('caption', message);
      if (input.link) body.append('link', input.link);
      buildPublishedPayload(body, input.scheduledPublishAt);
      body.append('source', new Blob([bytes], { type: mimeType }), basename(media.filePath));
      result = await graphMultipartRequest(`/${encodeURIComponent(nodeId)}/photos`, body);
    } else if (media.url) {
      progress(2, 4, 'image-upload-start', { source: 'url' });
      const body = new URLSearchParams();
      body.set('access_token', accessToken);
      body.set('url', media.url);
      if (message) body.set('caption', message);
      if (input.link) body.set('link', input.link);
      buildPublishedPayload(body, input.scheduledPublishAt);
      result = await graphJsonRequest(`/${encodeURIComponent(nodeId)}/photos`, body);
    } else {
      throw new Error('Facebook image publish requires filePath or url');
    }
    progress(3, 4, 'image-upload-complete');
  } else if (media?.kind === 'video') {
    progress(1, 4, 'prepare-video');
    if (media.filePath) {
      const mimeType = extensionToMimeType(media.filePath, media.mimeType || 'video/mp4');
      const fileSizeBytes = await stat(media.filePath).then(s => s.size).catch(() => undefined);
      const resumableThresholdBytes = (() => {
        const raw = Number(process.env.FACEBOOK_VIDEO_RESUMABLE_THRESHOLD_MB || '20');
        if (!Number.isFinite(raw) || raw <= 0) return 20 * 1024 * 1024;
        return Math.floor(raw * 1024 * 1024);
      })();
      console.log(
        `[FacebookUpload] FACEBOOK_VIDEO_RESUMABLE_THRESHOLD_MB=${String(process.env.FACEBOOK_VIDEO_RESUMABLE_THRESHOLD_MB || '20')} (thresholdBytes=${resumableThresholdBytes})`
      );
      progress(2, 4, 'video-upload-start', {
        fileSizeBytes,
        mimeType,
        resumableThresholdBytes,
      });
      const shouldUseResumable =
        typeof fileSizeBytes === 'number' &&
        Number.isFinite(fileSizeBytes) &&
        fileSizeBytes >= resumableThresholdBytes;

      try {
        if (shouldUseResumable && typeof fileSizeBytes === 'number') {
          progress(2, 4, 'video-resumable-start', { fileSizeBytes, resumableThresholdBytes });
          result = await uploadFacebookVideoFromFileResumable({
            nodeId,
            accessToken,
            filePath: media.filePath,
            fileSizeBytes,
            message,
            link: input.link,
            scheduledPublishAt: input.scheduledPublishAt,
            progress,
          });
        } else {
          result = await uploadFacebookVideoFromFile({
            nodeId,
            accessToken,
            filePath: media.filePath,
            mimeType,
            message,
            link: input.link,
            scheduledPublishAt: input.scheduledPublishAt,
          });
        }
        progress(3, 4, 'video-upload-complete');
      } catch (error) {
        if (
          isFacebookPayloadTooLargeError(error) &&
          typeof fileSizeBytes === 'number' &&
          Number.isFinite(fileSizeBytes)
        ) {
          progress(3, 6, 'video-direct-upload-413-fallback');
          progress(4, 6, 'video-resumable-start', { fileSizeBytes });
          result = await uploadFacebookVideoFromFileResumable({
            nodeId,
            accessToken,
            filePath: media.filePath,
            fileSizeBytes,
            message,
            link: input.link,
            scheduledPublishAt: input.scheduledPublishAt,
            progress,
          });
          progress(6, 6, 'video-resumable-complete');
          const idFromResumable = cleanString(result?.id || result?.post_id || result?.video_id);
          if (!idFromResumable) {
            throw new Error('Facebook resumable upload completed but no video id returned');
          }
        }

        if (!isUnsupportedFacebookVideoFormatError(error)) {
          throw error;
        }

        progress(3, 6, 'video-format-unsupported-detected');
        progress(4, 6, 'video-transcode-start');
        const transcodedPath = await transcodeVideoToFacebookCompatibleMp4(media.filePath);
        try {
          const transcodedSizeBytes = await stat(transcodedPath).then(s => s.size).catch(() => undefined);
          progress(5, 6, 'video-retry-upload-start', { transcodedSizeBytes, mimeType: 'video/mp4' });
          try {
            result = await uploadFacebookVideoFromFile({
              nodeId,
              accessToken,
              filePath: transcodedPath,
              mimeType: 'video/mp4',
              message,
              link: input.link,
              scheduledPublishAt: input.scheduledPublishAt,
            });
          } catch (retryError) {
            if (
              isFacebookPayloadTooLargeError(retryError) &&
              typeof transcodedSizeBytes === 'number' &&
              Number.isFinite(transcodedSizeBytes)
            ) {
              result = await uploadFacebookVideoFromFileResumable({
                nodeId,
                accessToken,
                filePath: transcodedPath,
                fileSizeBytes: transcodedSizeBytes,
                message,
                link: input.link,
                scheduledPublishAt: input.scheduledPublishAt,
                progress,
              });
            } else {
              throw retryError;
            }
          }
          progress(6, 6, 'video-retry-upload-complete');
        } finally {
          await unlink(transcodedPath).catch(() => undefined);
        }
      }
    } else if (media.url) {
      progress(2, 4, 'video-upload-start', { source: 'url' });
      const body = new URLSearchParams();
      body.set('access_token', accessToken);
      body.set('file_url', media.url);
      if (message) body.set('description', message);
      if (input.link) body.set('link', input.link);
      buildPublishedPayload(body, input.scheduledPublishAt);
      result = await graphJsonRequest(
        `/${encodeURIComponent(nodeId)}/videos`,
        body,
        { baseUrl: FACEBOOK_GRAPH_VIDEO_API_BASE }
      );
      progress(3, 4, 'video-upload-complete');
    } else {
      throw new Error('Facebook video publish requires filePath or url');
    }
  } else {
    progress(1, 3, 'prepare-text-post');
    progress(2, 3, 'text-post-send');
    const body = new URLSearchParams();
    body.set('access_token', accessToken);
    if (message) body.set('message', message);
    if (input.link) body.set('link', input.link);
    buildPublishedPayload(body, input.scheduledPublishAt);
    result = await graphJsonRequest(`/${encodeURIComponent(nodeId)}/feed`, body);
    progress(3, 3, 'text-post-complete');
  }

  const id = cleanString(result?.id || result?.post_id || result?.video_id);
  if (!id) {
    throw new Error('Facebook API did not return a post ID');
  }

  const doneSteps = media?.kind === 'video' ? 4 : media?.kind === 'image' ? 4 : 3;
  progress(doneSteps, doneSteps, 'done', { postId: id });

  return {
    id,
    url: resolveResultUrl(nodeId, id),
    nodeId,
  };
}

async function uploadUnpublishedPhoto(params: {
  nodeId: string;
  accessToken: string;
  media: FacebookAlbumMedia;
}): Promise<string> {
  const { nodeId, accessToken, media } = params;
  let result: any;

  if (media.filePath) {
    const bytes = await readFile(media.filePath);
    const mimeType = extensionToMimeType(media.filePath, media.mimeType || 'image/jpeg');
    const body = new FormData();
    body.append('access_token', accessToken);
    body.append('published', 'false');
    body.append('source', new Blob([bytes], { type: mimeType }), basename(media.filePath));
    result = await graphMultipartRequest(`/${encodeURIComponent(nodeId)}/photos`, body);
  } else if (media.url) {
    const body = new URLSearchParams();
    body.set('access_token', accessToken);
    body.set('published', 'false');
    body.set('url', media.url);
    result = await graphJsonRequest(`/${encodeURIComponent(nodeId)}/photos`, body);
  } else {
    throw new Error('Facebook album photo requires filePath or url');
  }

  const mediaFbid = cleanString(result?.id);
  if (!mediaFbid) {
    throw new Error('Facebook API did not return uploaded photo id');
  }
  return mediaFbid;
}

export async function publishFacebookPhotoAlbum(input: {
  target: PlatformAccount;
  message?: string;
  photos: FacebookAlbumMedia[];
  link?: string;
}): Promise<FacebookPublishResult> {
  const nodeId = resolveTargetNodeId(input.target);
  const accessToken = resolveAccessToken(input.target);
  if (!accessToken) {
    throw new Error('Facebook target is missing a page access token');
  }

  const photos = Array.isArray(input.photos) ? input.photos.filter(Boolean) : [];
  if (photos.length < 2) {
    throw new Error('Facebook album publish requires at least 2 photos');
  }
  const totalSteps = photos.length + 3;
  const progress = createVideoProgressLogger({
    flow: 'telegram-album-to-facebook',
    platform: 'facebook',
    targetId: input.target.id,
  });
  progress(1, totalSteps, 'album-prepare', { mediaTotal: photos.length });

  const mediaFbids: string[] = [];
  for (let idx = 0; idx < photos.length; idx += 1) {
    const photo = photos[idx];
    progress(2 + idx, totalSteps, 'album-photo-upload', {
      mediaIndex: idx + 1,
      mediaTotal: photos.length,
    });
    const mediaFbid = await uploadUnpublishedPhoto({
      nodeId,
      accessToken,
      media: photo,
    });
    mediaFbids.push(mediaFbid);
  }

  const body = new URLSearchParams();
  body.set('access_token', accessToken);
  const message = cleanString(input.message);
  if (message) body.set('message', message);
  if (input.link) body.set('link', input.link);
  mediaFbids.forEach((mediaFbid, idx) => {
    body.set(`attached_media[${idx}]`, JSON.stringify({ media_fbid: mediaFbid }));
  });

  progress(totalSteps - 1, totalSteps, 'album-compose-post');
  const result = await graphJsonRequest(`/${encodeURIComponent(nodeId)}/feed`, body);
  const id = cleanString(result?.id);
  if (!id) {
    throw new Error('Facebook API did not return post ID for album');
  }
  progress(totalSteps, totalSteps, 'done', { postId: id, mediaTotal: photos.length });

  return {
    id,
    url: resolveResultUrl(nodeId, id),
    nodeId,
  };
}
