// أنواع المنصات وواجهاتها المشتركة

export type PlatformId = 
  | 'facebook' 
  | 'instagram' 
  | 'twitter' 
  | 'tiktok' 
  | 'youtube' 
  | 'telegram' 
  | 'linkedin'
  | 'pinterest'
  | 'google_business'
  | 'threads'
  | 'snapchat'
  | 'whatsapp';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  icon: string;
  color: string;
  apiUrl?: string;
  supportedContentTypes: ('text' | 'image' | 'video' | 'link')[];
  maxContentLength: number;
  requiresMediaUpload: boolean;
  supportsScheduling: boolean;
  supportsRecurring: boolean;
  supportsAnalytics: boolean;
}

export interface AuthConfig {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  webhookSecret?: string;
}

export interface PostRequest {
  content: string;
  media?: {
    type: 'image' | 'video' | 'link';
    url?: string;
    file?: File;
    alt?: string;
  };
  scheduleTime?: Date;
  hashtags?: string[];
  mentions?: string[];
}

export interface PostResponse {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  scheduledFor?: Date;
}

export interface AccountInfo {
  id: string;
  username: string;
  name: string;
  bio?: string;
  followers?: number;
  following?: number;
  avatar?: string;
}

export interface AnalyticsData {
  date: Date;
  posts: number;
  engagements: number;
  clicks: number;
  reach: number;
  impressions: number;
  saves?: number;
  shares?: number;
}

export interface AuthResponse {
  success: boolean;
  accountInfo?: AccountInfo;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

export interface BasePlatformHandler {
  config: PlatformConfig;
  
  // Auth methods
  authenticate(config: AuthConfig): Promise<AuthResponse>;
  refreshAuth(refreshToken: string): Promise<AuthResponse>;
  revokeAuth(accessToken: string): Promise<boolean>;
  
  // Post methods
  publishPost(post: PostRequest, token: string): Promise<PostResponse>;
  schedulePost(post: PostRequest, token: string): Promise<PostResponse>;
  editPost(postId: string, post: PostRequest, token: string): Promise<PostResponse>;
  deletePost(postId: string, token: string): Promise<boolean>;
  
  // Account methods
  getAccountInfo(token: string): Promise<AccountInfo | null>;
  
  // Analytics methods
  getAnalytics(token: string, startDate: Date, endDate: Date): Promise<AnalyticsData[]>;
}
