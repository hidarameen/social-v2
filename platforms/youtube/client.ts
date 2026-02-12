import { promises as fs } from 'fs';
import crypto from 'crypto';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3';
const YOUTUBE_SAFE_TITLE_MAX_LENGTH = 90;

export type YouTubeUploadOptions = {
  title?: string;
  description?: string;
  tags?: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  embeddable?: boolean;
  license?: 'youtube' | 'creativeCommon';
  publicStatsViewable?: boolean;
  selfDeclaredMadeForKids?: boolean;
  notifySubscribers?: boolean;
  publishAt?: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
  recordingDate?: string;
};

export type YouTubePlaylist = {
  id: string;
  title: string;
  description?: string;
  itemCount?: number;
  channelId?: string;
};

type YouTubeApiError = {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

export class YouTubeClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      ...extra,
    };
  }

  private parseErrorBody(body: string): string {
    try {
      const data = JSON.parse(body) as YouTubeApiError;
      const top = data?.error?.message || '';
      const reason = data?.error?.errors?.[0]?.reason || '';
      const detail = data?.error?.errors?.[0]?.message || '';
      return [top, reason, detail].filter(Boolean).join(' | ');
    } catch {
      return body;
    }
  }

  private sanitizeTags(tags?: string[]): string[] | undefined {
    if (!Array.isArray(tags)) return undefined;
    const deduped = [...new Set(tags.map(tag => String(tag || '').trim()).filter(Boolean))];
    return deduped.length > 0 ? deduped : undefined;
  }

  private sanitizeTitle(title?: string): string {
    const cleaned = String(title || '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return 'Untitled';

    const chars = Array.from(cleaned);
    if (chars.length <= YOUTUBE_SAFE_TITLE_MAX_LENGTH) {
      return cleaned;
    }

    const sliced = chars.slice(0, YOUTUBE_SAFE_TITLE_MAX_LENGTH).join('').trim();
    const cutIndex = sliced.lastIndexOf(' ');
    if (cutIndex >= Math.floor(YOUTUBE_SAFE_TITLE_MAX_LENGTH * 0.6)) {
      return sliced.slice(0, cutIndex).trim();
    }
    return sliced;
  }

  private buildMetadata(options: YouTubeUploadOptions = {}) {
    const snippet: Record<string, any> = {
      title: this.sanitizeTitle(options.title),
      description: options.description || '',
      categoryId: options.categoryId || '22',
    };
    const tags = this.sanitizeTags(options.tags);
    if (tags) snippet.tags = tags;
    if (options.defaultLanguage) snippet.defaultLanguage = options.defaultLanguage;
    if (options.defaultAudioLanguage) snippet.defaultAudioLanguage = options.defaultAudioLanguage;

    const status: Record<string, any> = {
      privacyStatus: options.privacyStatus || 'public',
      selfDeclaredMadeForKids: options.selfDeclaredMadeForKids ?? false,
      embeddable: options.embeddable ?? true,
      license: options.license || 'youtube',
      publicStatsViewable: options.publicStatsViewable ?? true,
    };
    if (options.publishAt) {
      const publishDate = new Date(options.publishAt);
      if (Number.isNaN(publishDate.getTime())) {
        throw new Error('Invalid YouTube publishAt value');
      }
      // YouTube scheduled publishing requires private visibility until publish time.
      status.publishAt = publishDate.toISOString();
      status.privacyStatus = 'private';
    }

    const metadata: Record<string, any> = { snippet, status };
    if (options.recordingDate) {
      metadata.recordingDetails = { recordingDate: options.recordingDate };
    }
    return metadata;
  }

  /**
   * Upload a video from a memory buffer.
   */
  async uploadVideoFromBuffer(
    videoData: Buffer,
    mimeType = 'video/mp4',
    options: YouTubeUploadOptions = {}
  ): Promise<{ videoId: string; url: string }> {
    try {
      if (!videoData || videoData.length === 0) {
        throw new Error('Video buffer is empty');
      }

      const metadata = this.buildMetadata(options);
      const parts = ['snippet', 'status'];
      if (metadata.recordingDetails) {
        parts.push('recordingDetails');
      }

      const query = new URLSearchParams({
        part: parts.join(','),
        uploadType: 'resumable',
      });
      if (typeof options.notifySubscribers === 'boolean') {
        query.set('notifySubscribers', String(options.notifySubscribers));
      }

      const initializeResponse = await fetch(`${YOUTUBE_UPLOAD_API}/videos?${query.toString()}`, {
        method: 'POST',
        headers: this.authHeaders({
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(videoData.length),
        }),
        body: JSON.stringify(metadata),
      });
      const initializeText = await initializeResponse.text().catch(() => '');
      if (!initializeResponse.ok) {
        const detail = this.parseErrorBody(initializeText);
        throw new Error(
          `YouTube API error: ${initializeResponse.status} ${initializeResponse.statusText}${detail ? ` | ${detail}` : ''}`
        );
      }

      const uploadUrl = initializeResponse.headers.get('location');
      if (!uploadUrl) {
        throw new Error('YouTube upload initialization response missing upload URL');
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: this.authHeaders({
          'Content-Type': mimeType,
        }),
        body: new Uint8Array(videoData),
      });

      const uploadText = await uploadResponse.text().catch(() => '');
      if (!uploadResponse.ok) {
        const detail = this.parseErrorBody(uploadText);
        throw new Error(
          `YouTube API error: ${uploadResponse.status} ${uploadResponse.statusText}${detail ? ` | ${detail}` : ''}`
        );
      }

      const data = uploadText ? (JSON.parse(uploadText) as any) : {};
      const videoId = data?.id ? String(data.id) : '';
      if (!videoId) {
        throw new Error('YouTube upload response missing video id');
      }

      return {
        videoId,
        url: `https://youtube.com/watch?v=${videoId}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to upload YouTube video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload a video from a file path.
   */
  async uploadVideoFromFile(
    filePath: string,
    options: YouTubeUploadOptions = {},
    mimeType = 'video/mp4'
  ): Promise<{ videoId: string; url: string }> {
    const videoData = await fs.readFile(filePath);
    return this.uploadVideoFromBuffer(videoData, mimeType, options);
  }

  /**
   * Backward-compatible upload method.
   */
  async uploadVideo(
    videoData: Buffer,
    title: string,
    description: string,
    tags?: string[],
    privacy?: 'public' | 'unlisted' | 'private'
  ): Promise<{ videoId: string; url: string }> {
    return this.uploadVideoFromBuffer(videoData, 'video/mp4', {
      title,
      description,
      tags,
      privacyStatus: privacy,
    });
  }

  async addVideoToPlaylist(videoId: string, playlistId: string): Promise<{ id: string }> {
    const payload = {
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId,
        },
      },
    };
    const response = await fetch(`${YOUTUBE_API}/playlistItems?part=snippet`, {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const detail = this.parseErrorBody(text);
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}${detail ? ` | ${detail}` : ''}`);
    }
    const data = text ? (JSON.parse(text) as any) : {};
    const id = data?.id ? String(data.id) : '';
    if (!id) {
      throw new Error('YouTube playlist insert response missing id');
    }
    return { id };
  }

  async getPlaylists(maxResults = 50): Promise<YouTubePlaylist[]> {
    const result: YouTubePlaylist[] = [];
    let pageToken: string | undefined;

    while (true) {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        mine: 'true',
        maxResults: String(Math.min(50, Math.max(1, maxResults))),
      });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(`${YOUTUBE_API}/playlists?${params.toString()}`, {
        headers: this.authHeaders(),
      });
      const text = await response.text().catch(() => '');
      if (!response.ok) {
        const detail = this.parseErrorBody(text);
        throw new Error(`YouTube API error: ${response.status} ${response.statusText}${detail ? ` | ${detail}` : ''}`);
      }
      const data = text ? (JSON.parse(text) as any) : {};
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const item of items) {
        result.push({
          id: String(item?.id || ''),
          title: String(item?.snippet?.title || ''),
          description: item?.snippet?.description ? String(item.snippet.description) : undefined,
          itemCount: typeof item?.contentDetails?.itemCount === 'number' ? item.contentDetails.itemCount : undefined,
          channelId: item?.snippet?.channelId ? String(item.snippet.channelId) : undefined,
        });
      }
      pageToken = data?.nextPageToken ? String(data.nextPageToken) : undefined;
      if (!pageToken || result.length >= maxResults) break;
    }

    return result.slice(0, maxResults).filter(item => item.id && item.title);
  }

  /**
   * Get channel videos
   */
  async getVideos(limit = 10): Promise<any[]> {
    try {
      const channelResponse = await fetch(
        `${YOUTUBE_API}/channels?part=contentDetails&mine=true`,
        { headers: this.authHeaders() }
      );

      if (!channelResponse.ok) {
        throw new Error(`YouTube API error: ${channelResponse.statusText}`);
      }

      const channelData = (await channelResponse.json()) as any;
      const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        throw new Error('No uploads playlist found');
      }

      const videosResponse = await fetch(
        `${YOUTUBE_API}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${limit}`,
        { headers: this.authHeaders() }
      );

      if (!videosResponse.ok) {
        throw new Error(`YouTube API error: ${videosResponse.statusText}`);
      }

      const videosData = (await videosResponse.json()) as any;
      return videosData.items || [];
    } catch (error) {
      throw new Error(
        `Failed to fetch videos: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get video statistics
   */
  async getVideoStats(videoId: string): Promise<any> {
    try {
      const response = await fetch(
        `${YOUTUBE_API}/videos?part=statistics,contentDetails&id=${videoId}`,
        { headers: this.authHeaders() }
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.items?.[0] || null;
    } catch (error) {
      throw new Error(
        `Failed to fetch video stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update video details
   */
  async updateVideo(videoId: string, updates: { title?: string; description?: string; tags?: string[] }): Promise<boolean> {
    try {
      const getResponse = await fetch(
        `${YOUTUBE_API}/videos?part=snippet&id=${videoId}`,
        { headers: this.authHeaders() }
      );

      if (!getResponse.ok) {
        throw new Error(`YouTube API error: ${getResponse.statusText}`);
      }

      const videoData = (await getResponse.json()) as any;
      const video = videoData.items[0];

      if (updates.title) video.snippet.title = updates.title;
      if (updates.description) video.snippet.description = updates.description;
      if (updates.tags) video.snippet.tags = updates.tags;

      const updateResponse = await fetch(
        `${YOUTUBE_API}/videos?part=snippet`,
        {
          method: 'PUT',
          headers: this.authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(video),
        }
      );

      return updateResponse.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete a video
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${YOUTUBE_API}/videos?id=${videoId}`,
        { method: 'DELETE', headers: this.authHeaders() }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get channel info
   */
  async getChannelInfo(): Promise<{ channelId: string; title: string; avatar: string; subscriberCount?: string }> {
    try {
      const response = await fetch(
        `${YOUTUBE_API}/channels?part=snippet,statistics&mine=true`,
        { headers: this.authHeaders() }
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const channel = data.items[0];

      return {
        channelId: channel.id,
        title: channel.snippet.title,
        avatar: channel.snippet.thumbnails.high.url,
        subscriberCount: channel.statistics.subscriberCount,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch channel info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify access token
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(
        `${YOUTUBE_API}/channels?part=snippet&mine=true`,
        { headers: this.authHeaders() }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Generate YouTube OAuth URL
 */
export function generateYouTubeAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent select_account',
    state: crypto.randomUUID(),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Refresh YouTube/Google OAuth token.
 */
export async function refreshYouTubeToken(
  refreshToken: string,
  credentials: { clientId: string; clientSecret?: string }
): Promise<{ accessToken: string; refreshToken?: string }> {
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();
  if (!clientId) {
    throw new Error('Missing YouTube client ID in platform credentials');
  }
  if (!clientSecret) {
    throw new Error('Missing YouTube client secret in platform credentials');
  }

  const body = new URLSearchParams();
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await response.text().catch(() => '');
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.access_token) {
    const detail = String(data?.error_description || data?.error || text || response.statusText);
    throw new Error(`YouTube token refresh failed: ${detail}`);
  }

  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
  };
}
