export type OutstandingNetworkId =
  | 'facebook'
  | 'instagram'
  | 'x'
  | 'tiktok'
  | 'youtube'
  | 'telegram'
  | 'linkedin'
  | 'pinterest'
  | 'google_business'
  | 'threads'
  | 'snapchat'
  | 'whatsapp';

export interface OutstandingSocialAccount {
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

export interface OutstandingCreatePostPayload {
  content?: string;
  accounts: string[];
  scheduledAt?: string;
  containers?: Array<{
    content?: string;
    media?: Array<{ url: string }>;
  }>;
}

export interface OutstandingPost {
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

export interface OutstandingEnvelope<T> {
  success?: boolean;
  data?: T;
  post?: OutstandingPost;
  message?: string;
  error?: unknown;
}
