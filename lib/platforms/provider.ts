import type { PlatformId } from './types';
import { getBufferUserSettings, isBufferEnabledForPlatform } from '@/lib/buffer-user-settings';

export type PlatformApiProvider = 'native' | 'buffer';

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
    normalized === 'buffer'
  ) {
    return 'buffer';
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

function resolveBufferPlatformSet(): Set<PlatformId> {
  return parsePlatformList(
    process.env.BUFFER_PLATFORMS ||
      process.env.SOCIAL_API_BUFFER_PLATFORMS ||
      process.env.SOCIAL_API_PROVIDER_BUFFER_PLATFORMS
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

  // If BUFFER_PLATFORMS is explicitly configured, it becomes the source of truth:
  // listed platforms => buffer, others => native.
  const selectedBufferPlatforms = resolveBufferPlatformSet();
  if (selectedBufferPlatforms.size > 0) {
    return selectedBufferPlatforms.has(platformId) ? 'buffer' : 'native';
  }

  return getGlobalPlatformApiProvider();
}

export function isBufferProvider(platformId: PlatformId): boolean {
  return getPlatformApiProvider(platformId) === 'buffer';
}

export async function getPlatformApiProviderForUser(
  userId: string,
  platformId: PlatformId
): Promise<PlatformApiProvider> {
  try {
    const settings = await getBufferUserSettings(userId);
    if (isBufferEnabledForPlatform(settings, platformId)) {
      if (String(settings.accessToken || '').trim().length > 0) {
        return 'buffer';
      }
      // Misconfigured user settings: Buffer selected but access token is missing.
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

export async function isBufferProviderForUser(
  userId: string,
  platformId: PlatformId
): Promise<boolean> {
  return (await getPlatformApiProviderForUser(userId, platformId)) === 'buffer';
}
