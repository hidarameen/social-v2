import { db, type PlatformAccount, type Task } from '@/lib/db';
import { stat } from 'fs/promises';
import {
  YouTubeClient,
  refreshYouTubeToken,
  type YouTubeUploadOptions,
} from '@/platforms/youtube/client';
import { DEFAULT_YOUTUBE_CATEGORY_ID, resolveYouTubeCategoryId } from '@/lib/youtube-categories';
import { getOAuthClientCredentials } from '@/lib/platform-credentials';
import { createVideoProgressLogger } from '@/lib/services/video-progress';

type TemplateContext = {
  text?: string;
  username?: string;
  name?: string;
  date?: string;
  link?: string;
  media?: string;
  taskId?: string;
};

export type YouTubePublishInput = {
  target: PlatformAccount;
  filePath: string;
  mimeType?: string;
  transformations?: Task['transformations'];
  context?: TemplateContext;
};

type NormalizedYouTubeActions = {
  uploadVideo: boolean;
  uploadVideoToPlaylist: boolean;
  playlistId?: string;
};

const YOUTUBE_TITLE_MAX_LENGTH = 90;

function renderTemplate(template: string | undefined, context: TemplateContext, fallback: string): string {
  const base = String(template || '').trim() || fallback;
  const tokens: Record<string, string> = {
    text: context.text || '',
    username: context.username || '',
    name: context.name || '',
    date: context.date || '',
    link: context.link || '',
    media: context.media || '',
  };
  let result = base;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(`%${key}%`).join(value);
  }
  return result.trim();
}

function compactText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join(' ');
}

function stripControlChars(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ');
}

function truncateTextAtWordBoundary(text: string, maxLength: number): string {
  const chars = Array.from(text);
  if (chars.length <= maxLength) {
    return text;
  }

  const sliced = chars.slice(0, maxLength).join('').trim();
  const cutIndex = sliced.lastIndexOf(' ');
  if (cutIndex >= Math.floor(maxLength * 0.6)) {
    return sliced.slice(0, cutIndex).trim();
  }
  return sliced;
}

function sanitizeYouTubeTitle(title: string, maxLength = YOUTUBE_TITLE_MAX_LENGTH): string {
  const cleaned = stripControlChars(String(title || ''))
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return '';
  }
  return truncateTextAtWordBoundary(cleaned, maxLength);
}

function extractTitleFromText(text: string, maxLength = YOUTUBE_TITLE_MAX_LENGTH): string {
  const normalized = String(text || '').replace(/\r/g, '\n');
  const lines = normalized
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const firstLine = lines[0] || '';
  const firstSentence = firstLine.split(/[.!?؟]/)[0]?.trim() || '';
  const candidate = firstSentence || firstLine || compactText(normalized);
  return sanitizeYouTubeTitle(candidate, maxLength);
}

function normalizeActions(transformations?: Task['transformations']): NormalizedYouTubeActions {
  const input = transformations?.youtubeActions || {};
  const normalized: NormalizedYouTubeActions = {
    uploadVideo: Boolean(input.uploadVideo),
    uploadVideoToPlaylist: Boolean(input.uploadVideoToPlaylist),
    playlistId: typeof input.playlistId === 'string' ? input.playlistId.trim() : undefined,
  };
  if (!normalized.uploadVideo && !normalized.uploadVideoToPlaylist) {
    normalized.uploadVideo = true;
  }
  if (normalized.uploadVideoToPlaylist && !normalized.playlistId) {
    throw new Error('YouTube action "Upload video to playlist" requires playlist selection');
  }
  return normalized;
}

function buildUploadOptions(
  transformations: Task['transformations'] | undefined,
  context: TemplateContext
): YouTubeUploadOptions {
  const yt = transformations?.youtubeVideo || {};
  const fallbackText = (context.text || '').trim();
  const defaultTitle = extractTitleFromText(fallbackText) || 'SocialFlow Upload';
  const defaultDescription = fallbackText || context.link || '';
  const renderedTitle = renderTemplate(yt.titleTemplate, context, defaultTitle);
  const finalTitle = sanitizeYouTubeTitle(renderedTitle) || defaultTitle;
  const normalizedCategoryId =
    resolveYouTubeCategoryId(yt.categoryId) || DEFAULT_YOUTUBE_CATEGORY_ID;

  const tags = Array.isArray(yt.tags)
    ? yt.tags.map(tag => String(tag || '').trim()).filter(Boolean)
    : undefined;

  return {
    title: finalTitle,
    description: renderTemplate(yt.descriptionTemplate, context, defaultDescription).slice(0, 5000),
    tags,
    categoryId: normalizedCategoryId,
    privacyStatus: yt.privacyStatus || 'public',
    embeddable: yt.embeddable ?? true,
    license: yt.license || 'youtube',
    publicStatsViewable: yt.publicStatsViewable ?? true,
    selfDeclaredMadeForKids: yt.selfDeclaredMadeForKids ?? false,
    notifySubscribers: yt.notifySubscribers ?? true,
    publishAt: yt.publishAt,
    defaultLanguage: yt.defaultLanguage,
    defaultAudioLanguage: yt.defaultAudioLanguage,
    recordingDate: yt.recordingDate,
  };
}

export async function executeYouTubePublish(input: YouTubePublishInput): Promise<{
  id: string;
  url: string;
  playlistItemId?: string;
  settingsUsed: YouTubeUploadOptions;
}> {
  const actions = normalizeActions(input.transformations);
  const options = buildUploadOptions(input.transformations, input.context || {});
  const totalSteps = actions.uploadVideoToPlaylist && actions.playlistId ? 6 : 4;
  const progress = createVideoProgressLogger({
    flow: 'video-to-youtube',
    platform: 'youtube',
    taskId: input.context?.taskId,
    targetId: input.target.id,
  });
  let accessToken = input.target.accessToken;
  let refreshToken = input.target.refreshToken;
  let refreshed = false;
  const fileSizeBytes = await stat(input.filePath).then(s => s.size).catch(() => undefined);
  progress(1, totalSteps, 'prepare-metadata', { fileSizeBytes, mimeType: input.mimeType || 'video/mp4' });

  const withYouTubeRetry = async <T>(operation: (client: YouTubeClient) => Promise<T>): Promise<T> => {
    try {
      return await operation(new YouTubeClient(accessToken));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      const lower = message.toLowerCase();
      const unauthorized =
        lower.includes('401') ||
        lower.includes('unauthorized') ||
        lower.includes('invalid credentials') ||
        lower.includes('autherror');

      if (!unauthorized || refreshed || !refreshToken) {
        throw error;
      }

      const oauthCreds = await getOAuthClientCredentials(input.target.userId, 'youtube');
      const next = await refreshYouTubeToken(refreshToken, oauthCreds);
      accessToken = next.accessToken;
      refreshToken = next.refreshToken ?? refreshToken;
      refreshed = true;
      progress(2, totalSteps, 'token-refreshed');

      await db.updateAccount(input.target.id, {
        accessToken,
        refreshToken,
      });

      return operation(new YouTubeClient(accessToken));
    }
  };

  progress(2, totalSteps, 'upload-start');
  const uploaded = await withYouTubeRetry((client) =>
    client.uploadVideoFromFile(input.filePath, options, input.mimeType || 'video/mp4')
  );
  progress(3, totalSteps, 'upload-complete', { videoId: uploaded.videoId, url: uploaded.url });

  let playlistItemId: string | undefined;
  if (actions.uploadVideoToPlaylist && actions.playlistId) {
    progress(4, totalSteps, 'playlist-attach-start', { playlistId: actions.playlistId });
    const playlistResult = await withYouTubeRetry((client) =>
      client.addVideoToPlaylist(uploaded.videoId, actions.playlistId as string)
    );
    playlistItemId = playlistResult.id;
    progress(5, totalSteps, 'playlist-attach-complete', { playlistItemId });
    progress(6, totalSteps, 'done');
  } else {
    progress(4, totalSteps, 'done');
  }

  return {
    id: uploaded.videoId,
    url: uploaded.url,
    playlistItemId,
    settingsUsed: options,
  };
}
