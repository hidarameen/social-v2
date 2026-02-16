import { createHmac, timingSafeEqual } from 'crypto';

type MobileTokenPayload = {
  uid: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
};

type MobileUser = {
  id: string;
  email: string;
  name: string;
};

const MOBILE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getMobileAuthSecret(): string {
  const secret =
    process.env.MOBILE_AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    '';

  if (secret) return secret;

  // Development fallback only. For production, set MOBILE_AUTH_SECRET.
  return 'dev-mobile-auth-secret-change-me';
}

function signPayload(payloadPart: string): string {
  const signature = createHmac('sha256', getMobileAuthSecret()).update(payloadPart).digest();
  return toBase64Url(signature);
}

export function issueMobileAccessToken(user: MobileUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: MobileTokenPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    iat: now,
    exp: now + MOBILE_TOKEN_TTL_SECONDS,
  };

  const payloadPart = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signaturePart = signPayload(payloadPart);
  return `${payloadPart}.${signaturePart}`;
}

export function verifyMobileAccessToken(token: string): MobileUser | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const payloadPart = parts[0];
  const providedSignaturePart = parts[1];
  if (!payloadPart || !providedSignaturePart) return null;

  const expectedSignaturePart = signPayload(payloadPart);
  const provided = Buffer.from(providedSignaturePart, 'utf8');
  const expected = Buffer.from(expectedSignaturePart, 'utf8');

  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const payloadRaw = fromBase64Url(payloadPart).toString('utf8');
    const payload = JSON.parse(payloadRaw) as MobileTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.uid || !payload.email || !payload.name) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;

    return {
      id: payload.uid,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
