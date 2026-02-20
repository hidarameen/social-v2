import type { PlatformType } from "../../PlatformIcons";

export type ManualPublishMode = "now" | "schedule";
export type ManualMediaType = "image" | "video" | "link";

export type AccountOption = {
  id: string;
  platformId: PlatformType;
  accountName: string;
  accountUsername?: string;
  isActive: boolean;
};

export type ManualValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type ManualValidationEntry = {
  accountId: string;
  platformId: PlatformType;
  accountName: string;
  issues: ManualValidationIssue[];
};

export type ManualResultEntry = {
  accountId: string;
  platformId: PlatformType;
  accountName: string;
  success: boolean;
  postId?: string;
  url?: string;
  scheduledFor?: string;
  error?: string;
};

export type ManualPublishResponse = {
  success: boolean;
  partialSuccess?: boolean;
  dryRun?: boolean;
  error?: string;
  mode?: ManualPublishMode;
  scheduledAt?: string;
  succeededCount?: number;
  failedCount?: number;
  validation?: ManualValidationEntry[];
  results?: ManualResultEntry[];
};

export type ManualPlatformOverride = {
  message?: string;
  mediaUrl?: string;
  mediaType?: ManualMediaType;
};

export type ManualPlatformTemplateSettings = {
  enabled?: boolean;
  defaultHashtags?: string[];
  notes?: string;
};

export type ManualTemplate = {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  message: string;
  mediaUrl?: string;
  mediaType?: ManualMediaType;
  defaultAccountIds: string[];
  platformOverrides: Partial<Record<PlatformType, ManualPlatformOverride>>;
  platformSettings?: Partial<Record<PlatformType, ManualPlatformTemplateSettings>>;
  createdAt: string;
  updatedAt: string;
};

export type UploadResponse = {
  success: boolean;
  url?: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  error?: string;
};

export type UploadedMedia = {
  url: string;
  kind: "image" | "video";
  mimeType?: string;
  fileName?: string;
  size?: number;
  localPreviewUrl?: string;
};

export type PlatformRule = {
  maxChars: number;
  supportsScheduling: boolean;
  requiresMedia: boolean;
  allowedMedia: ManualMediaType[];
  maxHashtags?: number;
};

export type AdaptationIssue = {
  level: "error" | "warning";
  message: string;
};

export type AdaptationEntry = {
  platformId: PlatformType;
  platformName: string;
  textLength: number;
  maxChars: number;
  issues: AdaptationIssue[];
};

export const DRAFT_STORAGE_KEY = "manual_publish_workspace_v3";
