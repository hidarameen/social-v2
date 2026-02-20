import { getMobileAccessToken } from "../../../services/api";
import { platforms, type PlatformType } from "../../PlatformIcons";
import type {
  AdaptationEntry,
  AdaptationIssue,
  ManualMediaType,
  ManualPlatformOverride,
  ManualPlatformTemplateSettings,
  ManualPublishMode,
  ManualPublishResponse,
  PlatformRule,
  UploadedMedia,
} from "./types";

export const PLATFORM_RULES: Record<PlatformType, PlatformRule> = {
  facebook: { maxChars: 63206, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 10 },
  instagram: { maxChars: 2200, supportsScheduling: true, requiresMedia: true, allowedMedia: ["image", "video"], maxHashtags: 30 },
  twitter: { maxChars: 280, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 5 },
  tiktok: { maxChars: 2200, supportsScheduling: true, requiresMedia: true, allowedMedia: ["video"], maxHashtags: 8 },
  youtube: { maxChars: 5000, supportsScheduling: true, requiresMedia: true, allowedMedia: ["video"], maxHashtags: 15 },
  telegram: { maxChars: 4096, supportsScheduling: false, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 30 },
  linkedin: { maxChars: 3000, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 8 },
  pinterest: { maxChars: 500, supportsScheduling: true, requiresMedia: true, allowedMedia: ["image", "video", "link"], maxHashtags: 10 },
  google_business: { maxChars: 1500, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 10 },
  threads: { maxChars: 500, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 10 },
  snapchat: { maxChars: 80, supportsScheduling: true, requiresMedia: true, allowedMedia: ["image", "video"], maxHashtags: 2 },
  whatsapp: { maxChars: 1024, supportsScheduling: true, requiresMedia: false, allowedMedia: ["image", "video", "link"], maxHashtags: 5 },
};

const PLATFORM_IDS = platforms.map((platform) => platform.id);

export function isPlatformType(value: string): value is PlatformType {
  return (PLATFORM_IDS as string[]).includes(value);
}

export function trim(value: unknown): string {
  return String(value || "").trim();
}

export function formatDateTime(value?: string, locale = "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "ar" ? "ar" : "en-US");
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}

export function inferMediaKind(url: string, provided?: ManualMediaType): "image" | "video" | null {
  if (provided === "image" || provided === "video") return provided;
  const normalized = trim(url).toLowerCase();
  if (!normalized) return null;
  if (/\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/.test(normalized)) return "image";
  if (/\.(mp4|mov|webm|m4v|avi|mkv)($|\?)/.test(normalized)) return "video";
  return null;
}

export function hashtagsFromInput(value: string): string[] {
  return value
    .split(/[,\s]+/g)
    .map((item) => trim(item).replace(/^#+/, ""))
    .filter(Boolean)
    .slice(0, 20);
}

export function toDateTimeLocal(date: Date): string {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return value.toISOString().slice(0, 16);
}

export async function manualPublishRequest(body: Record<string, unknown>): Promise<ManualPublishResponse> {
  const token = getMobileAccessToken();
  const response = await fetch("/api/manual-publish", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as ManualPublishResponse;
  if (!response.ok) {
    throw new Error(trim(payload.error) || `Request failed: ${response.status}`);
  }
  return payload;
}

export function buildAdaptationEntries(params: {
  selectedPlatforms: PlatformType[];
  baseMessage: string;
  mode: ManualPublishMode;
  scheduledAt: string;
  media: UploadedMedia | null;
  platformOverrides: Partial<Record<PlatformType, ManualPlatformOverride>>;
  platformSettings: Partial<Record<PlatformType, ManualPlatformTemplateSettings>>;
}): AdaptationEntry[] {
  const entries: AdaptationEntry[] = [];

  for (const platformId of params.selectedPlatforms) {
    const rule = PLATFORM_RULES[platformId];
    const override = params.platformOverrides[platformId] || {};
    const settings = params.platformSettings[platformId] || {};
    const base = trim(override.message) || trim(params.baseMessage);
    const hashtags = settings.defaultHashtags || [];
    const hashtagSuffix = hashtags.length > 0 ? `\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}` : "";
    const finalMessage = `${base}${hashtagSuffix}`.trim();
    const textLength = finalMessage.length;
    const mediaType = params.media?.kind;

    const issues: AdaptationIssue[] = [];
    if (!finalMessage && !mediaType) {
      issues.push({ level: "error", message: "Add text or media before publishing." });
    }
    if (textLength > rule.maxChars) {
      issues.push({
        level: "error",
        message: `Text exceeds limit by ${textLength - rule.maxChars} characters (${textLength}/${rule.maxChars}).`,
      });
    } else if (textLength > Math.floor(rule.maxChars * 0.9)) {
      issues.push({ level: "warning", message: `Text is near platform limit (${textLength}/${rule.maxChars}).` });
    }

    if (rule.requiresMedia && !mediaType) {
      issues.push({ level: "error", message: "This platform requires image or video media." });
    }

    if (mediaType && !rule.allowedMedia.includes(mediaType)) {
      issues.push({ level: "error", message: `Selected media type "${mediaType}" is not allowed on this platform.` });
    }

    if (params.mode === "schedule") {
      if (!rule.supportsScheduling) {
        issues.push({ level: "error", message: "Scheduling is not supported for this platform." });
      } else {
        const target = new Date(params.scheduledAt);
        if (Number.isNaN(target.getTime()) || target.getTime() <= Date.now() + 30_000) {
          issues.push({ level: "error", message: "Schedule time must be a valid future date." });
        }
      }
    }

    const hashtagCount = (finalMessage.match(/#[\w\p{L}\p{N}_-]+/gu) || []).length;
    if ((rule.maxHashtags || 0) > 0 && hashtagCount > (rule.maxHashtags || 0)) {
      issues.push({ level: "warning", message: `Hashtag count (${hashtagCount}) exceeds recommended ${rule.maxHashtags}.` });
    }

    entries.push({
      platformId,
      platformName: platforms.find((item) => item.id === platformId)?.name || platformId,
      textLength,
      maxChars: rule.maxChars,
      issues,
    });
  }

  return entries;
}
