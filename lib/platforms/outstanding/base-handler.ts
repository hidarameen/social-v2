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
import type { OutstandingNetworkId, OutstandingPost, OutstandingSocialAccount } from './types';
import {
  createOutstandPost,
  deleteOutstandSocialAccount,
  deleteOutstandPost,
  getOutstandNetworkAuthUrl,
  getOutstandSocialAccountMetrics,
  getOutstandTenantId,
  listOutstandSocialAccounts,
  normalizeSelector,
  parseOutstandNumber,
} from './client';

type TokenHints = {
  apiKey?: string;
  tenantId?: string;
  baseUrl?: string;
  selectors: string[];
};

type OutstandingHandlerOptions = {
  config: PlatformConfig;
  network: OutstandingNetworkId;
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
          parsed.outstandAccounts,
          parsed.outstandAccountIds,
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
          parsed.outstandAccountId,
          parsed.selector,
          parsed.accountSelector,
        ];
        for (const item of fromStrings) {
          const value = trimString(item);
          if (value) selectors.push(value);
        }

        const apiKey =
          trimString(parsed.apiKey) ||
          trimString(parsed.outstandApiKey) ||
          trimString(parsed.outstandingApiKey) ||
          undefined;

        const tenantId =
          trimString(parsed.tenantId) ||
          trimString(parsed.outstandTenantId) ||
          trimString(parsed.outstandingTenantId) ||
          undefined;

        const baseUrl =
          trimString(parsed.baseUrl) ||
          trimString(parsed.outstandBaseUrl) ||
          trimString(parsed.outstandingBaseUrl) ||
          undefined;

        return { apiKey, tenantId, baseUrl, selectors };
      }
    } catch {
      // Keep fallback parsing below.
    }
  }

  return { selectors: parseSelectorsFromRaw(raw) };
}

function buildBestEffortPostUrl(network: OutstandingNetworkId, post: OutstandingPost): string | undefined {
  const first = Array.isArray(post.socialAccounts) ? post.socialAccounts[0] : undefined;
  const platformPostId = trimString(first?.platformPostId);
  if (!platformPostId) return undefined;

  switch (network) {
    case 'x':
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
    case 'snapchat':
    case 'google_business':
    case 'whatsapp':
    case 'telegram':
    default:
      return undefined;
  }
}

function matchesSelector(account: OutstandingSocialAccount, selector: string): boolean {
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
  ]
    .map(normalizeSelector)
    .filter(Boolean);

  return candidates.includes(normalized);
}

function mapAccountToInfo(account?: OutstandingSocialAccount): AccountInfo | null {
  if (!account?.id) return null;
  return {
    id: String(account.id),
    username: trimString(account.username) || String(account.id),
    name: trimString(account.name) || trimString(account.username) || 'Outstand Account',
    followers: parseOutstandNumber(account.stats?.followers) || undefined,
    following: parseOutstandNumber(account.stats?.following) || undefined,
    avatar: trimString(account.avatarUrl) || undefined,
  };
}

function collectNumericMetricValues(payload: any): Record<string, number> {
  const source = payload?.metrics && typeof payload.metrics === 'object' ? payload.metrics : payload;
  if (!source || typeof source !== 'object') return {};

  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    map[key] = parseOutstandNumber(value);
  }
  return map;
}

export class OutstandingPlatformHandler implements BasePlatformHandler {
  config: PlatformConfig;

  private network: OutstandingNetworkId;
  private selectorsEnvKey: string;

  constructor(options: OutstandingHandlerOptions) {
    this.config = options.config;
    this.network = options.network;
    this.selectorsEnvKey = options.selectorsEnvKey;
  }

  private resolveApiKey(config?: AuthConfig, token?: string): string | undefined {
    const hints = parseTokenHints(token);
    const fromConfig = trimString(config?.apiKey);
    return fromConfig || hints.apiKey || undefined;
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

    return [this.network];
  }

  private async getMatchingAccounts(token?: string, apiKey?: string): Promise<OutstandingSocialAccount[]> {
    const hints = parseTokenHints(token);
    const accounts = await listOutstandSocialAccounts({
      network: this.network,
      limit: 200,
      apiKey: apiKey || hints.apiKey,
      tenantId: hints.tenantId,
      baseUrl: hints.baseUrl,
    });
    if (accounts.length === 0) return [];

    const selectors = this.resolveSelectors(token);
    if (selectors.length === 0) return accounts;

    const matched = accounts.filter((account) => selectors.some((selector) => matchesSelector(account, selector)));
    return matched.length > 0 ? matched : accounts;
  }

  private buildPostPayload(post: PostRequest, accountIds: string[]): {
    payload?: {
      content?: string;
      accounts: string[];
      scheduledAt?: string;
      containers?: Array<{ content?: string; media?: Array<{ url: string }> }>;
    };
    error?: string;
  } {
    if (accountIds.length === 0) {
      return { error: 'No Outstand target accounts configured for this platform.' };
    }

    const content = trimString(post.content);
    const mediaUrl = trimString(post.media?.url);
    if (!content && !mediaUrl) {
      return { error: 'Post content or media URL is required.' };
    }

    const payload: {
      content?: string;
      accounts: string[];
      scheduledAt?: string;
      containers?: Array<{ content?: string; media?: Array<{ url: string }> }>;
    } = {
      accounts: accountIds,
    };

    if (post.scheduleTime instanceof Date && !Number.isNaN(post.scheduleTime.getTime())) {
      payload.scheduledAt = post.scheduleTime.toISOString();
    }

    if (mediaUrl) {
      payload.containers = [
        {
          content: content || undefined,
          media: [{ url: mediaUrl }],
        },
      ];
    } else if (content) {
      payload.content = content;
    }

    return { payload };
  }

  private postResponseFromOutstand(post?: OutstandingPost, fallbackScheduledAt?: Date): PostResponse {
    const postId = trimString(post?.id);
    return {
      success: Boolean(postId),
      postId: postId || undefined,
      url: post ? buildBestEffortPostUrl(this.network, post) : undefined,
      scheduledFor:
        post?.scheduledAt && !Number.isNaN(new Date(post.scheduledAt).getTime())
          ? new Date(post.scheduledAt)
          : fallbackScheduledAt,
      error: postId ? undefined : 'Outstand API did not return post id.',
    };
  }

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    try {
      const apiKey = this.resolveApiKey(config);
      const accounts = await this.getMatchingAccounts(undefined, apiKey);
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
        error: error instanceof Error ? error.message : 'Outstand authentication failed',
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

  async revokeAuth(accessToken: string): Promise<boolean> {
    try {
      const hints = parseTokenHints(accessToken);
      const accountIds = hints.selectors.filter(Boolean);
      if (accountIds.length === 0) return false;

      const results = await Promise.all(
        accountIds.map(async (accountId) => {
          try {
            await deleteOutstandSocialAccount(accountId, hints.apiKey, hints.baseUrl);
            return true;
          } catch {
            return false;
          }
        })
      );
      return results.some(Boolean);
    } catch {
      return false;
    }
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.apiKey);
      const accountIds = accounts
        .map((account) => trimString(account.id))
        .filter((value): value is string => value.length > 0);
      const built = this.buildPostPayload(post, accountIds);
      if (!built.payload) {
        return { success: false, error: built.error || 'Failed to build Outstand post payload' };
      }

      const created = await createOutstandPost(built.payload, hints.apiKey, hints.baseUrl);
      return this.postResponseFromOutstand(created);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish via Outstand',
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
          error: replacement.error || 'Failed to create replacement post via Outstand',
        };
      }

      await this.deletePost(postId, token);
      return replacement;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit post via Outstand',
      };
    }
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    try {
      const hints = parseTokenHints(token);
      return await deleteOutstandPost(postId, hints.apiKey, hints.baseUrl);
    } catch {
      return false;
    }
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.apiKey);
      return mapAccountToInfo(accounts[0] || undefined);
    } catch {
      return null;
    }
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    try {
      const hints = parseTokenHints(token);
      const accounts = await this.getMatchingAccounts(token, hints.apiKey);
      if (accounts.length === 0) return [];

      const results = await Promise.all(
        accounts.slice(0, 20).map(async (account) => {
          const metricsPayload = await getOutstandSocialAccountMetrics(account.id, {
            since: startDate,
            until: endDate,
            apiKey: hints.apiKey,
            baseUrl: hints.baseUrl,
          });

          const metrics = collectNumericMetricValues(metricsPayload);
          const engagements =
            metrics.engagements ||
            metrics.total_engagements ||
            metrics.likes + metrics.comments + metrics.shares + metrics.replies;

          return {
            date: endDate,
            posts: metrics.posts || metrics.post_count || 0,
            engagements,
            clicks: metrics.clicks || metrics.link_clicks || 0,
            reach: metrics.reach || metrics.unique_views || 0,
            impressions: metrics.impressions || metrics.views || 0,
            shares: metrics.shares || metrics.reposts || 0,
            saves: metrics.saves || 0,
          } satisfies AnalyticsData;
        })
      );

      return results;
    } catch {
      return [];
    }
  }

  async getAuthUrl(
    apiKey?: string,
    redirectUri?: string,
    baseUrl?: string,
    tenantId?: string
  ): Promise<string | undefined> {
    return getOutstandNetworkAuthUrl({
      network: this.network,
      tenantId: tenantId || getOutstandTenantId(),
      apiKey,
      redirectUri,
      baseUrl,
    });
  }
}
