import type {
  AccountInfo,
  AnalyticsData,
  AuthConfig,
  AuthResponse,
  BasePlatformHandler,
  PlatformConfig,
  PostRequest,
  PostResponse,
} from '../types';
import type {
  BufferCreatePostPayload,
  BufferNetworkId,
  BufferPost,
  BufferSocialAccount,
} from './types';
import {
  createBufferPost,
  deleteBufferPost,
  getBufferSocialAccountMetrics,
  listBufferSocialAccounts,
  normalizeSelector,
  parseBufferNumber,
} from './client';

type TokenHints = {
  accessToken?: string;
  baseUrl?: string;
  selectors: string[];
};

type BufferHandlerOptions = {
  config: PlatformConfig;
  network: BufferNetworkId;
  selectorsEnvKey: string;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseSelectorsFromRaw(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTokenHints(token?: string): TokenHints {
  const raw = trimString(token);
  if (!raw) return { selectors: [] };

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as any;
      if (Array.isArray(parsed)) {
        return { selectors: parsed.map((value) => trimString(value)).filter(Boolean) };
      }
      if (parsed && typeof parsed === 'object') {
        const selectors: string[] = [];

        const fromArrays = [
          parsed.accounts,
          parsed.accountIds,
          parsed.profileIds,
          parsed.bufferProfileIds,
          parsed.selectors,
        ];
        for (const candidate of fromArrays) {
          if (Array.isArray(candidate)) {
            for (const item of candidate) {
              const value = trimString(item);
              if (value) selectors.push(value);
            }
          }
        }

        const fromStrings = [
          parsed.bufferProfileId,
          parsed.profileId,
          parsed.selector,
          parsed.accountSelector,
        ];
        for (const item of fromStrings) {
          const value = trimString(item);
          if (value) selectors.push(value);
        }

        const accessToken =
          trimString(parsed.accessToken) ||
          trimString(parsed.apiKey) ||
          trimString(parsed.bufferAccessToken) ||
          trimString(parsed.bufferApiKey) ||
          undefined;

        const baseUrl =
          trimString(parsed.baseUrl) ||
          trimString(parsed.bufferBaseUrl) ||
          undefined;

        return { accessToken, baseUrl, selectors };
      }
    } catch {
      // Keep fallback parsing below.
    }
  }

  return { selectors: parseSelectorsFromRaw(raw) };
}

function normalizeNetworkToken(value: string): string {
  const token = value.trim().toLowerCase();
  if (token === 'x') return 'twitter';
  if (token === 'google_business') return 'googlebusiness';
  return token;
}

function buildBestEffortPostUrl(network: BufferNetworkId, post: BufferPost): string | undefined {
  const first = Array.isArray(post.socialAccounts) ? post.socialAccounts[0] : undefined;
  const platformPostId = trimString(first?.platformPostId);
  if (!platformPostId) return undefined;

  switch (normalizeNetworkToken(network)) {
    case 'twitter':
      return `https://x.com/i/web/status/${platformPostId}`;
    case 'facebook':
      return `https://www.facebook.com/${platformPostId}`;
    case 'instagram':
      return `https://www.instagram.com/p/${platformPostId}/`;
    case 'youtube':
      return `https://www.youtube.com/watch?v=${platformPostId}`;
    case 'tiktok':
      return `https://www.tiktok.com/video/${platformPostId}`;
    case 'linkedin':
      return `https://www.linkedin.com/feed/update/${platformPostId}`;
    case 'pinterest':
      return `https://www.pinterest.com/pin/${platformPostId}`;
    case 'threads':
      return `https://www.threads.net/t/${platformPostId}`;
    default:
      return undefined;
  }
}

function matchesSelector(account: BufferSocialAccount, selector: string): boolean {
  const normalized = normalizeSelector(selector);
  if (!normalized) return false;

  const candidates = [
    trimString(account.id),
    trimString(account.username),
    trimString(account.name),
    trimString(account.network),
    trimString(account.metadata?.id),
    trimString(account.metadata?.username),
    trimString(account.metadata?.handle),
    trimString((account.metadata as any)?.service_id),
  ]
    .map(normalizeSelector)
    .filter(Boolean);

  return candidates.includes(normalized);
}

function mapAccountToInfo(account?: BufferSocialAccount): AccountInfo | null {
  if (!account?.id) return null;
  return {
    id: String(account.id),
    username: trimString(account.username) || String(account.id),
    name: trimString(account.name) || trimString(account.username) || 'Buffer Account',
    followers: parseBufferNumber(account.stats?.followers) || undefined,
    following: parseBufferNumber(account.stats?.following) || undefined,
    avatar: trimString(account.avatarUrl) || undefined,
  };
}

function collectNumericMetricValues(payload: any): Record<string, number> {
  if (!payload || typeof payload !== 'object') return {};
  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(payload)) {
    map[key] = parseBufferNumber(value);
  }
  return map;
}

export class BufferPlatformHandler implements BasePlatformHandler {
  config: PlatformConfig;

  private network: BufferNetworkId;
  private selectorsEnvKey: string;

  constructor(options: BufferHandlerOptions) {
    this.config = options.config;
    this.network = options.network;
    this.selectorsEnvKey = options.selectorsEnvKey;
  }

  private resolveAccessToken(config?: AuthConfig, token?: string): string | undefined {
    const hints = parseTokenHints(token);
    const fromConfig = trimString(config?.accessToken) || trimString(config?.apiKey);
    return fromConfig || hints.accessToken || undefined;
  }

  private resolveSelectors(token?: string): string[] {
    const hints = parseTokenHints(token);
    if (hints.selectors.length > 0) {
      return hints.selectors;
    }

    const fromEnv = trimString(process.env[this.selectorsEnvKey]);
    if (fromEnv) {
      return parseSelectorsFromRaw(fromEnv);
    }

    return [];
  }

  private async getMatchingAccounts(token?: string, accessToken?: string): Promise<BufferSocialAccount[]> {
    const hints = parseTokenHints(token);
    const accounts = await listBufferSocialAccounts({
      network: this.network,
      limit: 200,
      accessToken: accessToken || hints.accessToken,
      baseUrl: hints.baseUrl,
    });
    if (accounts.length === 0) return [];

    const selectors = this.resolveSelectors(token);
    if (selectors.length === 0) return accounts;

    return accounts.filter((account) => selectors.some((selector) => matchesSelector(account, selector)));
  }

  private buildPostPayload(post: PostRequest, profileIds: string[]): {
    payload?: BufferCreatePostPayload;
    error?: string;
  } {
    if (profileIds.length === 0) {
      return { error: 'No Buffer target profiles configured for this platform.' };
    }

    const content = trimString(post.content);
    const mediaUrl = trimString(post.media?.url);
    const text = content || (mediaUrl ? `Shared via SocialFlow ${mediaUrl}` : '');
    if (!text) {
      return { error: 'Post content or media URL is required.' };
    }

    return {
      payload: {
        text,
        profileIds,
        scheduledAt:
          post.scheduleTime instanceof Date && !Number.isNaN(post.scheduleTime.getTime())
            ? post.scheduleTime.toISOString()
            : undefined,
        mediaUrl: mediaUrl || undefined,
      },
    };
  }

  private postResponseFromBuffer(post?: BufferPost, fallbackScheduledAt?: Date): PostResponse {
    const postId = trimString(post?.id);
    return {
      success: Boolean(postId),
      postId: postId || undefined,
      url: post ? buildBestEffortPostUrl(this.network, post) : undefined,
      scheduledFor:
        post?.scheduledAt && !Number.isNaN(new Date(post.scheduledAt).getTime())
          ? new Date(post.scheduledAt)
          : fallbackScheduledAt,
      error: postId ? undefined : 'Buffer API did not return post id.',
    };
  }

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    try {
      const accessToken = this.resolveAccessToken(config);
      const accounts = await this.getMatchingAccounts(undefined, accessToken);
      const accountInfo = mapAccountToInfo(accounts[0] || undefined) || undefined;

      return {
        success: true,
        accountInfo,
        accessToken: trimString(config.accessToken) || undefined,
        refreshToken: trimString(config.refreshToken) || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Buffer authentication failed',
      };
    }
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    return {
      success: true,
      accessToken: trimString(refreshToken) || undefined,
      refreshToken: trimString(refreshToken) || undefined,
    };
  }

  async revokeAuth(_accessToken: string): Promise<boolean> {
    return false;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.accessToken);
      const profileIds = accounts
        .map((account) => trimString(account.id))
        .filter((value): value is string => value.length > 0);

      const built = this.buildPostPayload(post, profileIds);
      if (!built.payload) {
        return { success: false, error: built.error || 'Failed to build Buffer payload' };
      }

      const created = await createBufferPost(built.payload, hints.accessToken, hints.baseUrl);
      return this.postResponseFromBuffer(created, post.scheduleTime);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish via Buffer',
      };
    }
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    const scheduledPost: PostRequest = {
      ...post,
      scheduleTime: post.scheduleTime || new Date(Date.now() + 60_000),
    };
    const result = await this.publishPost(scheduledPost, token);
    if (result.success) {
      return {
        ...result,
        scheduledFor: scheduledPost.scheduleTime,
      };
    }
    return result;
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    try {
      const replacement = post.scheduleTime
        ? await this.schedulePost(post, token)
        : await this.publishPost(post, token);

      if (!replacement.success) {
        return {
          success: false,
          error: replacement.error || 'Failed to create replacement post via Buffer',
        };
      }

      await this.deletePost(postId, token);
      return replacement;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit post via Buffer',
      };
    }
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    try {
      const hints = parseTokenHints(token);
      return await deleteBufferPost(postId, hints.accessToken, hints.baseUrl);
    } catch {
      return false;
    }
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.accessToken);
      return mapAccountToInfo(accounts[0] || undefined);
    } catch {
      return null;
    }
  }

  async getAnalytics(token: string, _startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.accessToken);
      if (accounts.length === 0) return [];

      const results = await Promise.all(
        accounts.slice(0, 20).map(async (account) => {
          const metricsPayload = await getBufferSocialAccountMetrics(account.id, {
            accessToken: hints.accessToken,
            baseUrl: hints.baseUrl,
          });

          const metrics = collectNumericMetricValues(metricsPayload);

          return {
            date: endDate,
            posts: metrics.posts || 0,
            engagements: metrics.engagements || 0,
            clicks: metrics.clicks || 0,
            reach: metrics.reach || 0,
            impressions: metrics.impressions || 0,
            shares: metrics.shares || 0,
            saves: metrics.saves || 0,
          } satisfies AnalyticsData;
        })
      );

      return results;
    } catch {
      return [];
    }
  }
}
