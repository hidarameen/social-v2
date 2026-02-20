import type { PlatformId } from './types';
import { getOutstandUserSettings, isOutstandEnabledForPlatform } from '@/lib/outstand-user-settings';

export type PlatformApiProvider = 'native' | 'outstanding';

const PLATFORM_TOKEN_MAP: Record<string, PlatformId> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  x: 'twitter',
  tiktok: 'tiktok',
  youtube: 'youtube',
  telegram: 'telegram',
  linkedin: 'linkedin',
  pinterest: 'pinterest',
  google_business: 'google_business',
  googlebusiness: 'google_business',
  threads: 'threads',
  snapchat: 'snapchat',
  whatsapp: 'whatsapp',
};

function normalizeProvider(value: string | undefined): PlatformApiProvider {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'outstanding' ||
    normalized === 'outstand' ||
    normalized === 'outs' ||
    normalized === 'os'
  ) {
    return 'outstanding';
  }
  return 'native';
}

function parsePlatformList(value: string | undefined): Set<PlatformId> {
  const set = new Set<PlatformId>();
  const raw = String(value || '').trim();
  if (!raw) return set;

  for (const token of raw.split(/[\s,;|]+/)) {
    const normalized = token.trim().toLowerCase();
    if (!normalized) continue;
    const mapped = PLATFORM_TOKEN_MAP[normalized];
    if (mapped) set.add(mapped);
  }

  return set;
}

function resolveOutstandPlatformSet(): Set<PlatformId> {
  return parsePlatformList(
    process.env.OUTSTAND_PLATFORMS ||
      process.env.SOCIAL_API_OUTSTAND_PLATFORMS ||
      process.env.SOCIAL_API_PROVIDER_OUTSTAND_PLATFORMS
  );
}

export function getGlobalPlatformApiProvider(): PlatformApiProvider {
  return normalizeProvider(
    process.env.SOCIAL_API_PROVIDER ||
      process.env.SOCIAL_API_MODE ||
      process.env.PLATFORM_API_PROVIDER ||
      process.env.PLATFORM_API_MODE
  );
}

export function getPlatformApiProvider(platformId: PlatformId): PlatformApiProvider {
  const key = `SOCIAL_API_PROVIDER_${platformId.toUpperCase()}`;
  const keyMode = `SOCIAL_API_MODE_${platformId.toUpperCase()}`;
  const specific = process.env[key] || process.env[keyMode];
  if (specific) return normalizeProvider(specific);

  // If OUTSTAND_PLATFORMS is explicitly configured, it becomes the source of truth:
  // listed platforms => outstanding, others => native.
  const selectedOutstandPlatforms = resolveOutstandPlatformSet();
  if (selectedOutstandPlatforms.size > 0) {
    return selectedOutstandPlatforms.has(platformId) ? 'outstanding' : 'native';
  }

  return getGlobalPlatformApiProvider();
}

export function isOutstandingProvider(platformId: PlatformId): boolean {
  return getPlatformApiProvider(platformId) === 'outstanding';
}

export async function getPlatformApiProviderForUser(
  userId: string,
  platformId: PlatformId
): Promise<PlatformApiProvider> {
  try {
    const settings = await getOutstandUserSettings(userId);
    if (isOutstandEnabledForPlatform(settings, platformId)) {
      if (String(settings.apiKey || '').trim().length > 0) {
        return 'outstanding';
      }
      // Misconfigured user settings: Outstand selected but API key is missing.
      // Fall back to native provider instead of failing publish at runtime.
      return 'native';
    }
    if (settings.enabled && settings.platforms.length > 0) {
      return 'native';
    }
  } catch {
    // Fall back to environment provider resolution.
  }

  return getPlatformApiProvider(platformId);
}

export async function isOutstandingProviderForUser(
  userId: string,
  platformId: PlatformId
): Promise<boolean> {
  return (await getPlatformApiProviderForUser(userId, platformId)) === 'outstanding';
}
