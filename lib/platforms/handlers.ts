import type {
  AccountInfo,
  AnalyticsData,
  AuthConfig,
  AuthResponse,
  BasePlatformHandler,
  PlatformConfig,
  PlatformId,
  PostRequest,
  PostResponse,
} from './types';
import { facebookHandler } from './facebook';
import { getPlatformApiProvider, getPlatformApiProviderForUser } from './provider';
import { outstandingPlatformHandlers } from './outstanding';
export { getPlatformConfig, platformConfigs } from './configs';

// Instagram Handler
class InstagramHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'instagram',
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    apiUrl: 'https://graph.instagram.com/v18.0',
    supportedContentTypes: ['image', 'video'],
    maxContentLength: 2200,
    requiresMediaUpload: true,
    supportsScheduling: true,
    supportsRecurring: false,
    supportsAnalytics: true,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    return { success: true, accessToken: config.accessToken };
  }

  async refreshAuth(_refreshToken: string): Promise<AuthResponse> {
    return { success: true };
  }

  async revokeAuth(_accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(_post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId: `ig_${Date.now()}` };
  }

  async schedulePost(post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId: `ig_${Date.now()}`, scheduledFor: post.scheduleTime };
  }

  async editPost(postId: string, _post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(_postId: string, _token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(_token: string): Promise<AccountInfo | null> {
    return {
      id: 'ig_123456',
      username: 'demo_account',
      name: 'Demo Instagram',
      followers: 5000,
    };
  }

  async getAnalytics(_token: string, _startDate: Date, _endDate: Date): Promise<AnalyticsData[]> {
    return [{ date: new Date(), posts: 10, engagements: 500, clicks: 250, reach: 5000, impressions: 10000 }];
  }
}

// Twitter Handler
class TwitterHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'twitter',
    name: 'Twitter / X',
    icon: '𝕏',
    color: '#000000',
    apiUrl: 'https://api.twitter.com/2',
    supportedContentTypes: ['text', 'image', 'video', 'link'],
    maxContentLength: 280,
    requiresMediaUpload: true,
    supportsScheduling: true,
    supportsRecurring: false,
    supportsAnalytics: true,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    try {
      if (!config.accessToken) {
        return { success: false, error: 'Access token required' };
      }
      const accountInfo = await this.getAccountInfo(config.accessToken);
      return {
        success: !!accountInfo,
        accountInfo: accountInfo || undefined,
        accessToken: config.accessToken,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    return { success: false, error: 'Not implemented' };
  }

  async revokeAuth(accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    try {
      return { success: true, postId: `tw_${Date.now()}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed' };
    }
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `tw_${Date.now()}`, scheduledFor: post.scheduleTime };
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    return {
      id: 'tw_123456',
      username: 'demo_user',
      name: 'Demo Twitter Account',
      followers: 2000,
    };
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    return [{ date: new Date(), posts: 15, engagements: 800, clicks: 400, reach: 8000, impressions: 15000 }];
  }
}

// TikTok Handler
class TikTokHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'tiktok',
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    apiUrl: 'https://open.tiktok.com/api/v1',
    supportedContentTypes: ['video'],
    maxContentLength: 5000,
    requiresMediaUpload: true,
    supportsScheduling: true,
    supportsRecurring: false,
    supportsAnalytics: true,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    return { success: true, accessToken: config.accessToken };
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    return { success: true };
  }

  async revokeAuth(accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `tt_${Date.now()}` };
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `tt_${Date.now()}`, scheduledFor: post.scheduleTime };
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    return {
      id: 'tt_123456',
      username: 'demo_tiktok',
      name: 'Demo TikTok',
      followers: 50000,
    };
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    return [{ date: new Date(), posts: 30, engagements: 5000, clicks: 2000, reach: 50000, impressions: 100000 }];
  }
}

// YouTube Handler
class YouTubeHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'youtube',
    name: 'YouTube',
    icon: '📹',
    color: '#FF0000',
    apiUrl: 'https://www.googleapis.com/youtube/v3',
    supportedContentTypes: ['video', 'text'],
    maxContentLength: 5000,
    requiresMediaUpload: true,
    supportsScheduling: true,
    supportsRecurring: false,
    supportsAnalytics: true,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    return { success: true, accessToken: config.accessToken };
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    return { success: true };
  }

  async revokeAuth(accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `yt_${Date.now()}` };
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `yt_${Date.now()}`, scheduledFor: post.scheduleTime };
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    return {
      id: 'yt_123456',
      username: 'demochannelname',
      name: 'Demo Channel',
      followers: 10000,
    };
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    return [{ date: new Date(), posts: 5, engagements: 2000, clicks: 1000, reach: 20000, impressions: 50000 }];
  }
}

// Telegram Handler
class TelegramHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    color: '#0088cc',
    apiUrl: 'https://api.telegram.org',
    supportedContentTypes: ['text', 'image', 'video'],
    maxContentLength: 4096,
    requiresMediaUpload: true,
    supportsScheduling: false,
    supportsRecurring: false,
    supportsAnalytics: false,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    return { success: true, accessToken: config.accessToken };
  }

  async refreshAuth(refreshToken: string): Promise<AuthResponse> {
    return { success: true };
  }

  async revokeAuth(accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId: `tg_${Date.now()}` };
  }

  async schedulePost(post: PostRequest, token: string): Promise<PostResponse> {
    return { success: false, error: 'Scheduling not supported' };
  }

  async editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(postId: string, token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(token: string): Promise<AccountInfo | null> {
    return {
      id: 'tg_123456',
      username: 'demo_channel',
      name: 'Demo Telegram Channel',
    };
  }

  async getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]> {
    return [];
  }
}

// LinkedIn Handler
class LinkedInHandler implements BasePlatformHandler {
  config: PlatformConfig = {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    apiUrl: 'https://api.linkedin.com/rest',
    supportedContentTypes: ['text', 'image', 'video', 'link'],
    maxContentLength: 3000,
    requiresMediaUpload: true,
    supportsScheduling: true,
    supportsRecurring: false,
    supportsAnalytics: true,
  };

  async authenticate(config: AuthConfig): Promise<AuthResponse> {
    return { success: true, accessToken: config.accessToken };
  }

  async refreshAuth(_refreshToken: string): Promise<AuthResponse> {
    return { success: true };
  }

  async revokeAuth(_accessToken: string): Promise<boolean> {
    return true;
  }

  async publishPost(_post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId: `li_${Date.now()}` };
  }

  async schedulePost(post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId: `li_${Date.now()}`, scheduledFor: post.scheduleTime };
  }

  async editPost(postId: string, _post: PostRequest, _token: string): Promise<PostResponse> {
    return { success: true, postId };
  }

  async deletePost(_postId: string, _token: string): Promise<boolean> {
    return true;
  }

  async getAccountInfo(_token: string): Promise<AccountInfo | null> {
    return {
      id: 'li_123456',
      username: 'demo_user',
      name: 'Demo LinkedIn Profile',
      followers: 1500,
    };
  }

  async getAnalytics(_token: string, _startDate: Date, _endDate: Date): Promise<AnalyticsData[]> {
    return [{ date: new Date(), posts: 8, engagements: 400, clicks: 200, reach: 4000, impressions: 8000 }];
  }
}

// Platform Registry
export const nativePlatformHandlers: Record<PlatformId, BasePlatformHandler> = {
  facebook: facebookHandler,
  instagram: new InstagramHandler(),
  twitter: new TwitterHandler(),
  tiktok: new TikTokHandler(),
  youtube: new YouTubeHandler(),
  telegram: new TelegramHandler(),
  linkedin: new LinkedInHandler(),
};

export const platformHandlers: Record<PlatformId, BasePlatformHandler> = nativePlatformHandlers;

export function getPlatformHandler(platformId: PlatformId): BasePlatformHandler {
  const provider = getPlatformApiProvider(platformId);
  if (provider === 'outstanding') {
    return outstandingPlatformHandlers[platformId];
  }
  return nativePlatformHandlers[platformId];
}

export async function getPlatformHandlerForUser(
  userId: string,
  platformId: PlatformId
): Promise<BasePlatformHandler> {
  const provider = await getPlatformApiProviderForUser(userId, platformId);
  if (provider === 'outstanding') {
    return outstandingPlatformHandlers[platformId];
  }
  return nativePlatformHandlers[platformId];
}
