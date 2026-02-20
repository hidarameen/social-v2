import { db } from '@/lib/db';
import type { PlatformId } from '@/lib/platforms/types';

export const BUFFER_SETTINGS_PLATFORM_ID = 'buffer';

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

export const ALL_BUFFER_PLATFORM_IDS: PlatformId[] = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'telegram',
  'linkedin',
  'pinterest',
  'google_business',
  'threads',
  'snapchat',
  'whatsapp',
];

export type BufferUserSettings = {
  enabled: boolean;
  accessToken?: string;
  baseUrl?: string;
  platforms: PlatformId[];
  applyToAllAccounts: boolean;
};

export type BufferSelectorSource = {
  accountId?: unknown;
  accountUsername?: unknown;
  accountName?: unknown;
  username?: unknown;
  displayName?: unknown;
  credentials?: unknown;
};

type UpsertBufferUserSettingsInput = {
  enabled?: boolean;
  accessToken?: string;
  baseUrl?: string;
  platforms?: string[];
  applyToAllAccounts?: boolean;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pushSelector(map: Map<string, string>, value: unknown) {
  const trimmed = trimString(value);
  if (!trimmed) return;
  const key = trimmed.toLowerCase();
  if (!map.has(key)) {
    map.set(key, trimmed);
  }
}

function collectSelectorsFromRecord(map: Map<string, string>, record: Record<string, unknown>) {
  const scalarKeys = [
    'bufferProfileId',
    'bufferAccountId',
    'profileId',
    'selector',
    'accountSelector',
    'socialAccountId',
    'id',
    'accountId',
    'username',
    'handle',
    'chatId',
    'platformAccountId',
    'service_id',
  ];
  for (const key of scalarKeys) {
    pushSelector(map, record[key]);
  }

  const arrayKeys = [
    'profiles',
    'profileIds',
    'accounts',
    'accountIds',
    'bufferProfileIds',
    'selectors',
  ];
  for (const key of arrayKeys) {
    const raw = record[key];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      pushSelector(map, entry);
    }
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }
  return fallback;
}

function parsePlatformList(value: unknown): PlatformId[] {
  const tokens: string[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = trimString(item).toLowerCase();
      if (normalized) tokens.push(normalized);
    }
  } else {
    const raw = trimString(value);
    if (raw) {
      for (const item of raw.split(/[\s,;|]+/)) {
        const normalized = item.trim().toLowerCase();
        if (normalized) tokens.push(normalized);
      }
    }
  }

  const set = new Set<PlatformId>();
  for (const token of tokens) {
    const mapped = PLATFORM_TOKEN_MAP[token];
    if (mapped) set.add(mapped);
  }

  return [...set];
}

function normalizeSettings(raw: Record<string, unknown>): BufferUserSettings {
  const platforms = parsePlatformList(raw.platforms);
  const accessToken =
    trimString(raw.accessToken) ||
    trimString(raw.apiKey) ||
    undefined;

  return {
    enabled: parseBoolean(raw.enabled, false),
    accessToken,
    baseUrl: trimString(raw.baseUrl) || undefined,
    platforms,
    applyToAllAccounts: parseBoolean(raw.applyToAllAccounts, true),
  };
}

function getEnvBufferAccessToken(): string | undefined {
  return (
    trimString(process.env.BUFFER_ACCESS_TOKEN) ||
    trimString(process.env.BUFFER_API_KEY) ||
    undefined
  );
}

function getEnvBufferBaseUrl(): string | undefined {
  return trimString(process.env.BUFFER_API_BASE_URL) || undefined;
}

function serializeSettings(input: UpsertBufferUserSettingsInput): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  if (typeof input.enabled === 'boolean') output.enabled = input.enabled;
  if (typeof input.applyToAllAccounts === 'boolean') output.applyToAllAccounts = input.applyToAllAccounts;

  if (typeof input.accessToken === 'string') output.accessToken = input.accessToken.trim();
  if (typeof input.baseUrl === 'string') output.baseUrl = input.baseUrl.trim();
  if (Array.isArray(input.platforms)) output.platforms = parsePlatformList(input.platforms);

  return output;
}

export function isBufferEnabledForPlatform(settings: BufferUserSettings, platformId: PlatformId): boolean {
  if (!settings.enabled) return false;
  if (settings.platforms.length === 0) return false;
  return settings.platforms.includes(platformId);
}

export async function getBufferUserSettings(userId: string): Promise<BufferUserSettings> {
  const record = await db.getUserPlatformCredential(userId, BUFFER_SETTINGS_PLATFORM_ID);
  const raw = (record?.credentials || {}) as Record<string, unknown>;
  const normalized = normalizeSettings(raw);

  return {
    ...normalized,
    accessToken: normalized.accessToken || getEnvBufferAccessToken(),
    baseUrl: normalized.baseUrl || getEnvBufferBaseUrl(),
  };
}

export async function upsertBufferUserSettings(
  userId: string,
  input: UpsertBufferUserSettingsInput
): Promise<BufferUserSettings> {
  const current = await getBufferUserSettings(userId);
  const updates = serializeSettings(input);
  const mergedRaw: Record<string, unknown> = {
    enabled: current.enabled,
    accessToken: current.accessToken || '',
    baseUrl: current.baseUrl || '',
    platforms: current.platforms,
    applyToAllAccounts: current.applyToAllAccounts,
    ...updates,
  };

  const saved = await db.upsertUserPlatformCredential({
    userId,
    platformId: BUFFER_SETTINGS_PLATFORM_ID,
    credentials: mergedRaw,
  });

  return normalizeSettings((saved.credentials || {}) as Record<string, unknown>);
}

export function getBufferAccountSelectors(source: BufferSelectorSource): string[] {
  const selectors = new Map<string, string>();
  pushSelector(selectors, source.accountId);
  pushSelector(selectors, source.accountUsername);
  pushSelector(selectors, source.accountName);
  pushSelector(selectors, source.username);
  pushSelector(selectors, source.displayName);

  const credentials = toRecord(source.credentials);
  collectSelectorsFromRecord(selectors, credentials);
  collectSelectorsFromRecord(selectors, toRecord(credentials.customData));
  collectSelectorsFromRecord(selectors, toRecord(credentials.accountInfo));

  return [...selectors.values()];
}

export function createBufferPublishToken(params: {
  userId?: string;
  accessToken?: string;
  baseUrl?: string;
  applyToAllAccounts?: boolean;
  selectors?: string[];
}): string {
  const payload: Record<string, unknown> = {};
  const userId = trimString(params.userId);
  const accessToken = trimString(params.accessToken);
  const baseUrl = trimString(params.baseUrl);
  const applyToAllAccounts = params.applyToAllAccounts !== false;
  const selectors = Array.isArray(params.selectors)
    ? params.selectors
        .map((value) => trimString(value))
        .filter(Boolean)
    : [];

  if (userId) payload.userId = userId;
  if (accessToken) {
    payload.accessToken = accessToken;
    payload.apiKey = accessToken;
  }
  if (baseUrl) payload.baseUrl = baseUrl;
  if (!applyToAllAccounts) {
    payload.applyToAllAccounts = false;
    if (selectors.length > 0) {
      payload.selectors = selectors;
      payload.accounts = selectors;
      payload.profileIds = selectors;
      payload.accountSelector = selectors[0];
      payload.profileId = selectors[0];
    }
  }

  return JSON.stringify(payload);
}

export function createBufferPublishTokenForAccount(params: {
  userId?: string;
  accessToken?: string;
  baseUrl?: string;
  applyToAllAccounts?: boolean;
  account?: BufferSelectorSource;
}): string {
  const applyToAllAccounts = params.applyToAllAccounts !== false;
  const selectors =
    !applyToAllAccounts && params.account ? getBufferAccountSelectors(params.account) : [];

  return createBufferPublishToken({
    userId: params.userId,
    accessToken: params.accessToken,
    baseUrl: params.baseUrl,
    applyToAllAccounts,
    selectors,
  });
}
