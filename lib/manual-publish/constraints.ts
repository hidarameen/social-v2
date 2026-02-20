import type { PlatformId } from '@/lib/platforms/types';
import type { ManualPublishMediaType, ManualPublishMode } from '@/lib/manual-publish/types';

export type PlatformPublishRule = {
  maxChars: number;
  supportsScheduling: boolean;
  requiresMedia: boolean;
  allowedMedia: ManualPublishMediaType[];
  preferredAspectRatios?: string[];
  maxHashtags?: number;
};

export type ManualValidationIssue = {
  level: 'error' | 'warning';
  message: string;
};

export const PLATFORM_PUBLISH_RULES: Record<PlatformId, PlatformPublishRule> = {
  facebook: {
    maxChars: 63206,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 10,
  },
  instagram: {
    maxChars: 2200,
    supportsScheduling: true,
    requiresMedia: true,
    allowedMedia: ['image', 'video'],
    preferredAspectRatios: ['1:1', '4:5', '9:16'],
    maxHashtags: 30,
  },
  twitter: {
    maxChars: 280,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 5,
  },
  tiktok: {
    maxChars: 2200,
    supportsScheduling: true,
    requiresMedia: true,
    allowedMedia: ['video'],
    preferredAspectRatios: ['9:16'],
    maxHashtags: 8,
  },
  youtube: {
    maxChars: 5000,
    supportsScheduling: true,
    requiresMedia: true,
    allowedMedia: ['video'],
    preferredAspectRatios: ['16:9', '9:16'],
    maxHashtags: 15,
  },
  telegram: {
    maxChars: 4096,
    supportsScheduling: false,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 30,
  },
  linkedin: {
    maxChars: 3000,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 8,
  },
  pinterest: {
    maxChars: 500,
    supportsScheduling: true,
    requiresMedia: true,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 10,
  },
  google_business: {
    maxChars: 1500,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 10,
  },
  threads: {
    maxChars: 500,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 10,
  },
  snapchat: {
    maxChars: 80,
    supportsScheduling: true,
    requiresMedia: true,
    allowedMedia: ['image', 'video'],
    preferredAspectRatios: ['9:16'],
    maxHashtags: 2,
  },
  whatsapp: {
    maxChars: 1024,
    supportsScheduling: true,
    requiresMedia: false,
    allowedMedia: ['image', 'video', 'link'],
    maxHashtags: 5,
  },
};

function inferMediaType(mediaUrl?: string, mediaType?: ManualPublishMediaType): ManualPublishMediaType | undefined {
  if (mediaType) return mediaType;
  const source = String(mediaUrl || '').trim().toLowerCase();
  if (!source) return undefined;
  if (/\.(mp4|mov|webm|m4v|avi)($|\?)/.test(source)) return 'video';
  if (/\.(png|jpe?g|gif|webp)($|\?)/.test(source)) return 'image';
  return 'link';
}

function isLikelyPublicUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function validateManualPublishForPlatform(params: {
  platformId: PlatformId;
  mode: ManualPublishMode;
  message?: string;
  mediaUrl?: string;
  mediaType?: ManualPublishMediaType;
  scheduledAt?: Date;
}): ManualValidationIssue[] {
  const issues: ManualValidationIssue[] = [];
  const rule = PLATFORM_PUBLISH_RULES[params.platformId];
  const message = String(params.message || '');
  const mediaUrl = String(params.mediaUrl || '').trim();
  const resolvedMediaType = inferMediaType(mediaUrl, params.mediaType);

  const messageLength = message.length;
  if (messageLength > rule.maxChars) {
    issues.push({
      level: 'error',
      message: `Content is ${messageLength - rule.maxChars} characters over the ${rule.maxChars} limit.`,
    });
  } else if (messageLength > Math.floor(rule.maxChars * 0.9)) {
    issues.push({
      level: 'warning',
      message: `Content is near the character limit (${messageLength}/${rule.maxChars}).`,
    });
  }

  if (!message.trim() && !mediaUrl) {
    issues.push({
      level: 'error',
      message: 'Add content or media before publishing.',
    });
  }

  if (rule.requiresMedia && !mediaUrl) {
    issues.push({
      level: 'error',
      message: 'This platform requires media for publishing.',
    });
  }

  if (mediaUrl && !isLikelyPublicUrl(mediaUrl)) {
    issues.push({
      level: 'error',
      message: 'Media URL must be public and start with http:// or https://.',
    });
  }

  if (resolvedMediaType && !rule.allowedMedia.includes(resolvedMediaType)) {
    issues.push({
      level: 'error',
      message: `Unsupported media type "${resolvedMediaType}" for this platform.`,
    });
  }

  if (params.mode === 'schedule') {
    if (!rule.supportsScheduling) {
      issues.push({
        level: 'error',
        message: 'Scheduling is not supported for this platform.',
      });
    } else if (!params.scheduledAt || Number.isNaN(params.scheduledAt.getTime())) {
      issues.push({
        level: 'error',
        message: 'A valid schedule time is required.',
      });
    } else if (params.scheduledAt.getTime() <= Date.now() + 30_000) {
      issues.push({
        level: 'error',
        message: 'Scheduled time must be in the future.',
      });
    }
  }

  if (rule.maxHashtags && rule.maxHashtags > 0) {
    const hashtagCount = (message.match(/#[\w\p{L}\p{N}_-]+/gu) || []).length;
    if (hashtagCount > rule.maxHashtags) {
      issues.push({
        level: 'warning',
        message: `Hashtag count (${hashtagCount}) is above the recommended ${rule.maxHashtags}.`,
      });
    }
  }

  if ((params.platformId === 'twitter' || params.platformId === 'threads') && mediaUrl && !message.trim()) {
    issues.push({
      level: 'warning',
      message: 'Adding short text usually improves reach for this platform.',
    });
  }

  return issues;
}
