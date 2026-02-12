import type {
  BasePlatformHandler,
  PlatformConfig,
  AuthConfig,
  PostRequest,
  PostResponse,
  AccountInfo,
  AnalyticsData,
  AuthResponse,
} from '../types';

const FACEBOOK_GRAPH_API_BASE = 'https://graph.facebook.com/v22.0';

export const facebookConfig: PlatformConfig = {
  id: 'facebook',
  name: 'Facebook',
  icon: '📘',
  color: '#1877F2',
  apiUrl: FACEBOOK_GRAPH_API_BASE,
  supportedContentTypes: ['text', 'image', 'video', 'link'],
  maxContentLength: 63206,
  requiresMediaUpload: true,
  supportsScheduling: true,
  supportsRecurring: false,
  supportsAnalytics: true,
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatFacebookError(status: number, statusText: string, payload: any, fallbackText: string): string {
  const apiError = payload?.error;
  if (!apiError || typeof apiError !== 'object') {
    return `Facebook API error: ${status} ${statusText || fallbackText}`;
  }
  const message = cleanString(apiError.message) || `${status} ${statusText || fallbackText}`;
  const code = typeof apiError.code === 'number' ? apiError.code : undefined;
  if (code === 190) {
    return `Facebook token is invalid or expired. Reconnect account. (${message})`;
  }
  if (code === 200 || code === 10) {
    return `Facebook permissions are missing for this token/page. Ensure pages_manage_posts is approved. (${message})`;
  }
  return `Facebook API error: ${message}`;
}

async function graphRequest(path: string, init: RequestInit): Promise<any> {
  const response = await fetch(`${FACEBOOK_GRAPH_API_BASE}${path}`, init);
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

function resolveFacebookUrl(objectId: string): string {
  if (objectId.includes('_')) {
    return `https://www.facebook.com/${objectId}`;
  }
  return `https://www.facebook.com/${objectId}`;
}

function buildPublishBody(post: PostRequest, token: string, scheduleTime?: Date): URLSearchParams {
  const body = new URLSearchParams();
  body.set('access_token', token);
  if (cleanString(post.content)) {
    body.set('message', post.content);
  }
  if (post.media?.type === 'link' && cleanString(post.media.url)) {
    body.set('link', cleanString(post.media.url));
  }
  if (scheduleTime) {
    const epochSeconds = Math.floor(scheduleTime.getTime() / 1000);
    if (Number.isFinite(epochSeconds) && epochSeconds > 0) {
      body.set('published', 'false');
      body.set('scheduled_publish_time', String(epochSeconds));
    }
  }
  return body;
}

export class FacebookHandler implements BasePlatformHandler {
  config = facebookConfig;

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    try {
      if (!config.accessToken) {
        return { success: false, error: 'Access token required' };
      }
      const accountInfo = await this.getAccountInfo(config.accessToken);
      if (!accountInfo) {
        return { success: false, error: 'Failed to load Facebook account info' };
      }
      return {
        success: true,
        accountInfo,
        accessToken: config.accessToken,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  async refreshAuth(_refreshToken: string): Promise<AuthResponse> {
    return {
      success: false,
      error: 'Facebook refresh flow is not implemented; reconnect the account.',
    };
  }

  async revokeAuth(_accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    try {
      if (!cleanString(token)) {
        return { success: false, error: 'Missing Facebook access token' };
      }
      const body = buildPublishBody(post, token);
      const data = await graphRequest('/me/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const postId = cleanString(data?.id);
      if (!postId) {
        return { success: false, error: 'Facebook API did not return post ID' };
      }
      return {
        success: true,
        postId,
        url: resolveFacebookUrl(postId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish',
      };
    }
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    try {
      if (!cleanString(token)) {
        return { success: false, error: 'Missing Facebook access token' };
      }
      if (!post.scheduleTime) {
        return { success: false, error: 'Missing schedule time' };
      }
      const body = buildPublishBody(post, token, post.scheduleTime);
      const data = await graphRequest('/me/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const postId = cleanString(data?.id);
      if (!postId) {
        return { success: false, error: 'Facebook API did not return scheduled post ID' };
      }
      return {
        success: true,
        postId,
        scheduledFor: post.scheduleTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule',
      };
    }
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    try {
      if (!cleanString(token)) {
        return { success: false, error: 'Missing Facebook access token' };
      }
      const body = new URLSearchParams();
      body.set('access_token', token);
      body.set('message', post.content || '');
      await graphRequest(`/${encodeURIComponent(postId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      return {
        success: true,
        postId,
        url: resolveFacebookUrl(postId),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit',
      };
    }
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    try {
      if (!cleanString(token)) return false;
      const body = new URLSearchParams();
      body.set('access_token', token);
      await graphRequest(`/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      return true;
    } catch {
      return false;
    }
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    try {
      if (!cleanString(token)) return null;
      const data = await graphRequest(
        `/me?fields=id,name,picture.width(256).height(256),fan_count&access_token=${encodeURIComponent(token)}`,
        { method: 'GET' }
      );
      if (!data?.id) return null;
      return {
        id: String(data.id),
        username: String(data.name || data.id),
        name: String(data.name || 'Facebook Page'),
        followers:
          typeof data.fan_count === 'number' && Number.isFinite(data.fan_count)
            ? data.fan_count
            : undefined,
        avatar: cleanString(data?.picture?.data?.url) || undefined,
      };
    } catch {
      return null;
    }
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    try {
      if (!cleanString(token)) return [];
      const since = Math.floor(startDate.getTime() / 1000);
      const until = Math.floor(endDate.getTime() / 1000);
      const metric = [
        'page_impressions',
        'page_post_engagements',
        'page_actions_post_reactions_total',
      ].join(',');
      const data = await graphRequest(
        `/me/insights?metric=${encodeURIComponent(metric)}&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
        { method: 'GET' }
      );

      const metrics = Array.isArray(data?.data) ? data.data : [];
      const byDate = new Map<string, { impressions: number; engagements: number; reactions: number }>();
      for (const metricRow of metrics) {
        const name = cleanString(metricRow?.name);
        const values = Array.isArray(metricRow?.values) ? metricRow.values : [];
        for (const valueRow of values) {
          const endTime = cleanString(valueRow?.end_time);
          if (!endTime) continue;
          const key = new Date(endTime).toISOString().slice(0, 10);
          const prev = byDate.get(key) || { impressions: 0, engagements: 0, reactions: 0 };
          const value = Number(valueRow?.value);
          const safeValue = Number.isFinite(value) ? value : 0;
          if (name === 'page_impressions') prev.impressions += safeValue;
          if (name === 'page_post_engagements') prev.engagements += safeValue;
          if (name === 'page_actions_post_reactions_total') prev.reactions += safeValue;
          byDate.set(key, prev);
        }
      }

      return [...byDate.entries()].map(([dateKey, values]) => ({
        date: new Date(`${dateKey}T00:00:00.000Z`),
        posts: 0,
        engagements: values.engagements,
        clicks: 0,
        reach: 0,
        impressions: values.impressions,
        shares: values.reactions,
      }));
    } catch {
      return [];
    }
  }
}

export const facebookHandler = new FacebookHandler();
