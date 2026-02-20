import type {
  BufferCreatePostPayload,
  BufferNetworkId,
  BufferPost,
  BufferSocialAccount,
} from './types';

const DEFAULT_BUFFER_BASE_URL = 'https://api.bufferapp.com/1';

type RequestOptions = {
  accessToken?: string;
  allowMissingAccessToken?: boolean;
  baseUrl?: string;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value?: string): string {
  const source = trimString(value) || DEFAULT_BUFFER_BASE_URL;
  return source.replace(/\/+$/, '');
}

function resolveAccessToken(explicitToken?: string): string {
  return (
    trimString(explicitToken) ||
    trimString(process.env.BUFFER_ACCESS_TOKEN) ||
    trimString(process.env.BUFFER_API_KEY)
  );
}

function buildApiUrl(path: string, explicitBaseUrl?: string): string {
  const base = normalizeBaseUrl(explicitBaseUrl || process.env.BUFFER_API_BASE_URL);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

function withAccessToken(url: string, accessToken?: string): string {
  const token = trimString(accessToken);
  if (!token) return url;

  const parsed = new URL(url);
  if (!parsed.searchParams.get('access_token')) {
    parsed.searchParams.set('access_token', token);
  }
  return parsed.toString();
}

export class BufferApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'BufferApiError';
    this.status = status;
    this.details = details;
  }
}

function parseJsonResponse(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: any, fallback: string): string {
  const direct = trimString(payload?.message);
  if (direct) return direct;
  const nested = trimString(payload?.error);
  if (nested) return nested;
  return fallback;
}

export async function bufferRequest<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<T> {
  const accessToken = resolveAccessToken(options.accessToken);
  if (!accessToken && !options.allowMissingAccessToken) {
    throw new BufferApiError('Missing Buffer access token. Set BUFFER_ACCESS_TOKEN.');
  }

  const headers = new Headers(init.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const url = withAccessToken(buildApiUrl(path, options.baseUrl), accessToken);
  const response = await fetch(url, {
    ...init,
    headers,
  });

  const rawText = await response.text();
  const payload = parseJsonResponse(rawText) ?? rawText;

  if (!response.ok) {
    throw new BufferApiError(
      extractErrorMessage(payload, `Buffer API error: ${response.status} ${response.statusText}`),
      response.status,
      payload
    );
  }

  return payload as T;
}

function asNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapBufferProfile(profile: any): BufferSocialAccount | null {
  const id = trimString(profile?.id);
  if (!id) return null;

  const username =
    trimString(profile?.service_username) ||
    trimString(profile?.formatted_username) ||
    trimString(profile?.service_id) ||
    id;

  const name = trimString(profile?.formatted_service) || username;
  const network = trimString(profile?.service).toLowerCase();

  return {
    id,
    network,
    username,
    name,
    avatarUrl: trimString(profile?.avatar_https || profile?.avatar) || undefined,
    stats: {
      followers: asNumber(profile?.statistics?.followers),
      following: asNumber(profile?.statistics?.following),
    },
    metadata: profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : undefined,
  };
}

function normalizeNetworkToken(value: string): string {
  const token = value.trim().toLowerCase();
  if (token === 'x') return 'twitter';
  if (token === 'google_business') return 'googlebusiness';
  return token;
}

export async function listBufferSocialAccounts(params?: {
  network?: BufferNetworkId;
  limit?: number;
  accessToken?: string;
  baseUrl?: string;
}): Promise<BufferSocialAccount[]> {
  const response = await bufferRequest<any[]>('/profiles.json', { method: 'GET' }, {
    accessToken: params?.accessToken,
    baseUrl: params?.baseUrl,
  });

  const profiles = Array.isArray(response)
    ? response.map(mapBufferProfile).filter((entry): entry is BufferSocialAccount => Boolean(entry))
    : [];

  let filtered = profiles;
  if (params?.network) {
    const expected = normalizeNetworkToken(params.network);
    filtered = profiles.filter((account) => normalizeNetworkToken(String(account.network || '')) === expected);
  }

  if (typeof params?.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
    return filtered.slice(0, Math.floor(params.limit));
  }

  return filtered;
}

function mapBufferUpdate(update: any): BufferPost | undefined {
  if (!update || typeof update !== 'object') return undefined;

  const id = trimString(update.id || update.update_id);
  const profileId = trimString(update.profile_id);
  const service = trimString(update.service);
  const serviceUpdateId = trimString(update.service_update_id);
  const scheduledAt = trimString(update.due_at || update.scheduled_at);

  return {
    id: id || undefined,
    status: trimString(update.status) || undefined,
    scheduledAt: scheduledAt || undefined,
    socialAccounts: [
      {
        accountId: profileId || undefined,
        network: service || undefined,
        platformPostId: serviceUpdateId || undefined,
      },
    ],
  };
}

export async function createBufferPost(
  payload: BufferCreatePostPayload,
  accessToken?: string,
  baseUrl?: string
): Promise<BufferPost | undefined> {
  const text = trimString(payload.text);
  if (!text) {
    throw new BufferApiError('Post text is required for Buffer publishing.');
  }
  if (!Array.isArray(payload.profileIds) || payload.profileIds.length === 0) {
    throw new BufferApiError('At least one Buffer profile id is required.');
  }

  const body = new URLSearchParams();
  body.set('text', text);
  for (const id of payload.profileIds) {
    const normalized = trimString(id);
    if (normalized) {
      body.append('profile_ids[]', normalized);
    }
  }
  if (payload.scheduledAt) {
    body.set('scheduled_at', payload.scheduledAt);
  }
  if (payload.mediaUrl) {
    body.set('media[link]', payload.mediaUrl);
  }

  const response = await bufferRequest<any>(
    '/updates/create.json',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
    { accessToken, baseUrl }
  );

  if (Array.isArray(response?.updates) && response.updates.length > 0) {
    return mapBufferUpdate(response.updates[0]);
  }

  if (response?.update) {
    return mapBufferUpdate(response.update);
  }

  return mapBufferUpdate(response);
}

export async function deleteBufferPost(postId: string, accessToken?: string, baseUrl?: string): Promise<boolean> {
  const normalized = trimString(postId);
  if (!normalized) return false;

  await bufferRequest(`/updates/${encodeURIComponent(normalized)}/destroy.json`, {
    method: 'POST',
  }, { accessToken, baseUrl });
  return true;
}

export async function getBufferSocialAccountMetrics(
  socialAccountId: string,
  params: { accessToken?: string; baseUrl?: string } = {}
): Promise<Record<string, number>> {
  const normalizedId = trimString(socialAccountId);
  if (!normalizedId) return {};

  const profile = await bufferRequest<any>(
    `/profiles/${encodeURIComponent(normalizedId)}.json`,
    { method: 'GET' },
    { accessToken: params.accessToken, baseUrl: params.baseUrl }
  );

  return {
    followers: asNumber(profile?.statistics?.followers) || 0,
    following: asNumber(profile?.statistics?.following) || 0,
    posts: asNumber(profile?.statistics?.sent) || 0,
  };
}

export async function deleteBufferSocialAccount(
  _socialAccountId: string,
  _accessToken?: string,
  _baseUrl?: string
): Promise<boolean> {
  // Buffer public API does not expose a direct profile-delete endpoint for integrations.
  return false;
}

export function parseBufferNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function normalizeSelector(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}
