import { db } from '@/lib/db';

export const MANAGED_PLATFORM_IDS = [
  'twitter',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'linkedin',
  'telegram',
] as const;

export type ManagedPlatformId = (typeof MANAGED_PLATFORM_IDS)[number];

export type PlatformCredentialPayload = {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  webhookSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  botToken?: string;
  extra?: Record<string, any>;
};

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function sanitizeCredentialPayload(input: Record<string, unknown>): PlatformCredentialPayload {
  const payload: PlatformCredentialPayload = {
    clientId: sanitizeString(input.clientId),
    clientSecret: sanitizeString(input.clientSecret),
    apiKey: sanitizeString(input.apiKey),
    apiSecret: sanitizeString(input.apiSecret),
    bearerToken: sanitizeString(input.bearerToken),
    webhookSecret: sanitizeString(input.webhookSecret),
    accessToken: sanitizeString(input.accessToken),
    accessTokenSecret: sanitizeString(input.accessTokenSecret),
    botToken: sanitizeString(input.botToken),
  };

  if (input.extra && typeof input.extra === 'object' && !Array.isArray(input.extra)) {
    payload.extra = input.extra as Record<string, any>;
  }

  return payload;
}

export async function getUserPlatformCredentialMap(userId: string): Promise<Record<string, PlatformCredentialPayload>> {
  const rows = await db.getUserPlatformCredentials(userId);
  const mapped: Record<string, PlatformCredentialPayload> = {};
  for (const row of rows) {
    mapped[row.platformId] = sanitizeCredentialPayload(row.credentials || {});
  }
  return mapped;
}

export async function getPlatformCredential(
  userId: string,
  platformId: ManagedPlatformId
): Promise<PlatformCredentialPayload | undefined> {
  const row = await db.getUserPlatformCredential(userId, platformId);
  if (!row) return undefined;
  return sanitizeCredentialPayload(row.credentials || {});
}

export async function upsertPlatformCredential(
  userId: string,
  platformId: ManagedPlatformId,
  input: Record<string, unknown>
): Promise<PlatformCredentialPayload> {
  const credentials = sanitizeCredentialPayload(input);
  const saved = await db.upsertUserPlatformCredential({
    userId,
    platformId,
    credentials,
  });
  return sanitizeCredentialPayload(saved.credentials || {});
}

export async function getOAuthClientCredentials(userId: string, platformId: ManagedPlatformId): Promise<{
  clientId: string;
  clientSecret?: string;
}> {
  const credential = await getPlatformCredential(userId, platformId);
  const clientId = credential?.clientId || credential?.apiKey;
  const clientSecret = credential?.clientSecret || credential?.apiSecret;
  if (!clientId) {
    throw new Error(`Missing ${platformId} client ID. Add it in Settings > Platform API Credentials.`);
  }
  return { clientId, clientSecret };
}

export async function getTwitterBearerTokenForUser(userId: string): Promise<string | undefined> {
  const credential = await getPlatformCredential(userId, 'twitter');
  return credential?.bearerToken;
}

export async function getAnyTwitterBearerToken(): Promise<string | undefined> {
  const row = await db.getAnyPlatformCredential('twitter');
  if (!row) return undefined;
  return sanitizeCredentialPayload(row.credentials || {}).bearerToken;
}

export async function getTwitterWebhookSecretForUser(userId: string): Promise<string | undefined> {
  const credential = await getPlatformCredential(userId, 'twitter');
  return credential?.webhookSecret || credential?.apiSecret || credential?.clientSecret;
}

export async function getAnyTwitterWebhookSecret(): Promise<string | undefined> {
  const row = await db.getAnyPlatformCredential('twitter');
  if (!row) return undefined;
  const credential = sanitizeCredentialPayload(row.credentials || {});
  return credential.webhookSecret || credential.apiSecret || credential.clientSecret;
}

export async function getTwitterOAuth1CredentialsForUser(userId: string): Promise<{
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
} | undefined> {
  const credential = await getPlatformCredential(userId, 'twitter');
  if (!credential) return undefined;

  const consumerKey = credential.apiKey || credential.clientId;
  const consumerSecret = credential.apiSecret || credential.clientSecret;
  const token = credential.accessToken;
  const tokenSecret = credential.accessTokenSecret;

  if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
    return undefined;
  }

  return { consumerKey, consumerSecret, token, tokenSecret };
}

