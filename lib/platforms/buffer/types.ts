export type BufferNetworkId =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'telegram'
  | 'linkedin'
  | 'pinterest'
  | 'googlebusiness'
  | 'threads'
  | 'snapchat'
  | 'whatsapp';

export interface BufferSocialAccount {
  id: string;
  network?: string;
  username?: string;
  name?: string;
  avatarUrl?: string;
  stats?: {
    followers?: number;
    following?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface BufferCreatePostPayload {
  text: string;
  profileIds: string[];
  scheduledAt?: string;
  mediaUrl?: string;
}

export interface BufferPost {
  id?: string;
  status?: string;
  scheduledAt?: string;
  socialAccounts?: Array<{
    accountId?: string;
    network?: string;
    username?: string;
    status?: string;
    platformPostId?: string;
  }>;
}

export interface BufferEnvelope<T> {
  success?: boolean;
  data?: T;
  post?: BufferPost;
  message?: string;
  error?: unknown;
}
