import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth';
import { getOAuthPlatform } from '@/lib/oauth/platforms';
import { generateCodeChallenge, generateCodeVerifier, generateState } from '@/lib/oauth/utils';
import { getOAuthClientCredentials, type ManagedPlatformId } from '@/lib/platform-credentials';
import type { PlatformId } from '@/lib/platforms/types';
import { getPlatformApiProviderForUser } from '@/lib/platforms/provider';
import { outstandingPlatformHandlers } from '@/lib/platforms/outstanding';
import { getOutstandUserSettings } from '@/lib/outstand-user-settings';

export const runtime = 'nodejs';

const OAUTH_PLATFORM_IDS = new Set<PlatformId>([
  'twitter',
  'facebook',
  'instagram',
  'youtube',
  'tiktok',
  'telegram',
  'linkedin',
]);

function asOAuthManagedPlatformId(value: string): PlatformId | null {
  return OAUTH_PLATFORM_IDS.has(value as PlatformId) ? (value as PlatformId) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform: platformParam } = await params;
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const platform = getOAuthPlatform(platformParam);
  if (!platform) {
    return NextResponse.json({ success: false, error: 'Unknown platform' }, { status: 400 });
  }
  if (!platform.authUrl || !platform.tokenUrl) {
    const platformId = asOAuthManagedPlatformId(platform.id);
    const provider =
      platformId ? await getPlatformApiProviderForUser(user.id, platformId) : 'native';
    if (provider !== 'outstanding') {
      return NextResponse.json(
        { success: false, error: `${platform.name} does not support OAuth in this app` },
        { status: 400 }
      );
    }
  }

  const platformId = asOAuthManagedPlatformId(platform.id);
  const provider =
    platformId ? await getPlatformApiProviderForUser(user.id, platformId) : 'native';

  const state = generateState();
  const codeVerifier = platform.usePKCE ? generateCodeVerifier() : undefined;
  const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined;
  const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
  const redirectUri =
    provider === 'outstanding'
      ? `${baseUrl}/api/oauth/${platform.id}/callback?provider=outstanding`
      : `${baseUrl}/api/oauth/${platform.id}/callback`;
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/accounts';
  const responseMode = String(request.nextUrl.searchParams.get('mode') || '').trim().toLowerCase();
  const wantsJson = responseMode === 'json';

  const cookieStore = await cookies();
  cookieStore.set({
    name: `oauth_state_${platform.id}`,
    value: JSON.stringify({
      state,
      codeVerifier,
      userId: user.id,
      returnTo,
      provider,
    }),
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  });

  if (provider === 'outstanding') {
    if (!platformId) {
      return NextResponse.json({ success: false, error: 'Unsupported Outstand platform' }, { status: 400 });
    }

    const handler = outstandingPlatformHandlers[platformId];
    if (!handler || typeof (handler as any).getAuthUrl !== 'function') {
      return NextResponse.json(
        { success: false, error: `${platform.name} is not configured for Outstand OAuth` },
        { status: 400 }
      );
    }

    const outstandSettings = await getOutstandUserSettings(user.id);
    if (!outstandSettings.apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Outstand API key. Add it in Settings before connecting accounts.' },
        { status: 400 }
      );
    }

    const authUrl = await (handler as any).getAuthUrl(
      outstandSettings.apiKey,
      redirectUri,
      outstandSettings.baseUrl,
      outstandSettings.tenantId
    );
    if (!authUrl) {
      return NextResponse.json({ success: false, error: 'Failed to get Outstand auth URL' }, { status: 502 });
    }
    if (wantsJson) {
      return NextResponse.json({ success: true, url: authUrl });
    }
    return NextResponse.redirect(authUrl);
  }

  let clientId: string;
  try {
    ({ clientId } = await getOAuthClientCredentials(user.id, platform.id as ManagedPlatformId));
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Missing OAuth credentials' },
      { status: 400 }
    );
  }

  const paramsOut = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: (platform.scopes || []).join(' '),
    state,
  });

  if (codeChallenge) {
    paramsOut.set('code_challenge', codeChallenge);
    paramsOut.set('code_challenge_method', 'S256');
  }
  if (platform.authParams) {
    for (const [key, value] of Object.entries(platform.authParams)) {
      paramsOut.set(key, value);
    }
  }
  if (platform.id === 'facebook') {
    // Force FB to re-check permissions and avoid silently reusing old grants.
    paramsOut.set('auth_type', 'rerequest');
  }

  const authUrl = `${platform.authUrl}?${paramsOut.toString()}`;
  if (wantsJson) {
    return NextResponse.json({ success: true, url: authUrl });
  }
  return NextResponse.redirect(authUrl);
}
