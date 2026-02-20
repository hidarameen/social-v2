import type { PlatformId } from '@/lib/platforms/types';

export type ManualPublishMode = 'now' | 'schedule';

export type ManualPublishMediaType = 'image' | 'video' | 'link';

export type ManualPlatformOverride = {
  message?: string;
  mediaUrl?: string;
  mediaType?: ManualPublishMediaType;
};

export type ManualPublishTemplate = {
  id: string;
  name: string;
  description?: string;
  message: string;
  mediaUrl?: string;
  mediaType?: ManualPublishMediaType;
  defaultAccountIds: string[];
  platformOverrides: Partial<Record<PlatformId, ManualPlatformOverride>>;
  createdAt: string;
  updatedAt: string;
};

export type ManualPublishPayload = {
  message: string;
  mediaUrl?: string;
  mediaType?: ManualPublishMediaType;
  accountIds: string[];
  mode: ManualPublishMode;
  scheduledAt?: string;
  platformOverrides?: Partial<Record<PlatformId, ManualPlatformOverride>>;
};

export type ManualPublishExecutionResult = {
  accountId: string;
  platformId: PlatformId;
  accountName: string;
  success: boolean;
  postId?: string;
  url?: string;
  scheduledFor?: string;
  error?: string;
};
