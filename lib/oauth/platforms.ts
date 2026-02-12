export type OAuthPlatformId = 'twitter' | 'facebook' | 'instagram' | 'youtube' | 'tiktok' | 'linkedin' | 'telegram';

export type OAuthPlatformConfig = {
  id: OAuthPlatformId;
  name: string;
  authUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  usePKCE?: boolean;
  authParams?: Record<string, string>;
};

export const oauthPlatforms: Record<OAuthPlatformId, OAuthPlatformConfig> = {
  twitter: {
    id: 'twitter',
    name: 'Twitter / X',
    authUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'media.write', 'offline.access'],
    usePKCE: true,
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    scopes: [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
    ],
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube',
    ],
    authParams: {
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent select_account',
    },
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.publish'],
    usePKCE: true,
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
  },
  telegram: {
    id: 'telegram',
    name: 'Telegram',
  },
};

export function getOAuthPlatform(id: string): OAuthPlatformConfig | undefined {
  return oauthPlatforms[id as OAuthPlatformId];
}
