import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getOAuthPlatform } from '@/lib/oauth/platforms';
import { buildBasicAuth, decodeJwtPayload, safeJsonParse } from '@/lib/oauth/utils';
import { ensureTwitterPollingStarted } from '@/lib/services/twitter-poller';
import { ensureTwitterStreamStarted } from '@/lib/services/twitter-stream';
import { ensureSchedulerStarted } from '@/lib/services/task-scheduler';

export const runtime = 'nodejs';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  open_id?: string;
};

async function exchangeToken(platformId: string, code: string, redirectUri: string, codeVerifier?: string) {
  const platform = getOAuthPlatform(platformId);
  if (!platform?.tokenUrl) throw new Error('Missing token URL');

  const clientId = platform.clientIdEnv ? process.env[platform.clientIdEnv] : undefined;
  const clientSecret = platform.clientSecretEnv ? process.env[platform.clientSecretEnv] : undefined;
  if (!clientId) throw new Error(`Missing ${platform.clientIdEnv} in environment`);

  const body = new URLSearchParams();
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  switch (platform.id) {
    case 'twitter': {
      body.set('grant_type', 'authorization_code');
      body.set('code', code);
      body.set('client_id', clientId);
      body.set('redirect_uri', redirectUri);
      if (codeVerifier) body.set('code_verifier', codeVerifier);
      if (clientSecret) {
        headers.Authorization = buildBasicAuth(clientId, clientSecret);
      }
      break;
    }
    case 'facebook': {
      if (!clientSecret) throw new Error(`Missing ${platform.clientSecretEnv} in environment`);
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('redirect_uri', redirectUri);
      body.set('code', code);
      break;
    }
    case 'instagram': {
      if (!clientSecret) throw new Error(`Missing ${platform.clientSecretEnv} in environment`);
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('grant_type', 'authorization_code');
      body.set('redirect_uri', redirectUri);
      body.set('code', code);
      break;
    }
    case 'youtube': {
      if (!clientSecret) throw new Error(`Missing ${platform.clientSecretEnv} in environment`);
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('code', code);
      body.set('redirect_uri', redirectUri);
      body.set('grant_type', 'authorization_code');
      break;
    }
    case 'tiktok': {
      if (!clientSecret) throw new Error(`Missing ${platform.clientSecretEnv} in environment`);
      body.set('client_key', clientId);
      body.set('client_secret', clientSecret);
      body.set('code', code);
      body.set('grant_type', 'authorization_code');
      body.set('redirect_uri', redirectUri);
      if (codeVerifier) body.set('code_verifier', codeVerifier);
      break;
    }
    default:
      throw new Error('OAuth not implemented for this platform');
  }

  const res = await fetch(platform.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });
  const text = await res.text();
  const data = safeJsonParse<TokenResponse>(text) || ({} as TokenResponse);
  if (!res.ok) {
    throw new Error(data?.['error_description'] || data?.['error'] || `Token request failed: ${text}`);
  }
  return data;
}

async function fetchAccountInfo(platformId: string, accessToken?: string, tokenResponse?: TokenResponse) {
  switch (platformId) {
    case 'twitter': {
      if (!accessToken) return null;
      const res = await fetch('https://api.x.com/2/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data ? { id: data.data.id, username: data.data.username, name: data.data.name } : null;
    }
    case 'facebook': {
      if (!accessToken) return null;
      const res = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.id ? { id: data.id, name: data.name } : null;
    }
    case 'instagram': {
      if (!accessToken) return null;
      const res = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.id ? { id: data.id, username: data.username, name: data.username } : null;
    }
    case 'youtube': {
      const payload = decodeJwtPayload(tokenResponse?.id_token);
      if (!payload) return null;
      return { id: payload.sub, username: payload.email, name: payload.name || payload.email };
    }
    case 'tiktok': {
      if (tokenResponse?.open_id) {
        return { id: tokenResponse.open_id, username: tokenResponse.open_id, name: 'TikTok Account' };
      }
      return null;
    }
    default:
      return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
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
      return NextResponse.json(
        { success: false, error: `${platform.name} does not support OAuth in this app` },
        { status: 400 }
      );
    }

    const search = request.nextUrl.searchParams;
    const code = search.get('code');
    const state = search.get('state');
    if (!code || !state) {
      return NextResponse.json({ success: false, error: 'Missing code or state' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const raw = cookieStore.get(`oauth_state_${platform.id}`)?.value;
    if (!raw) {
      return NextResponse.json({ success: false, error: 'Missing OAuth state cookie' }, { status: 400 });
    }
    const parsed = safeJsonParse<{ state: string; codeVerifier?: string; userId: string; returnTo?: string }>(raw);
    if (!parsed || parsed.state !== state || parsed.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Invalid OAuth state' }, { status: 400 });
    }
    cookieStore.delete(`oauth_state_${platform.id}`);

    const appBaseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
    const redirectUri = `${appBaseUrl}/api/oauth/${platform.id}/callback`;
    const tokenResponse = await exchangeToken(platform.id, code, redirectUri, parsed.codeVerifier);
    const accessToken = tokenResponse.access_token;
    const refreshToken = tokenResponse.refresh_token;

    const accountInfo = await fetchAccountInfo(platform.id, accessToken, tokenResponse);
    const accountId = accountInfo?.id || `${platform.id}_${Date.now()}`;
    const accountName = accountInfo?.name || `${platform.name} Account`;
    const accountUsername = accountInfo?.username || accountName;

    const existing = (await db.getUserAccounts(user.id)).find(
      a => a.platformId === platform.id && a.accountId === accountId
    );
    if (!existing) {
      await db.createAccount({
        id: randomUUID(),
        userId: user.id,
        platformId: platform.id,
        accountName,
        accountUsername,
        accountId,
        accessToken: accessToken || 'oauth',
        refreshToken: refreshToken,
        credentials: {
          tokenResponse,
          accountInfo,
        },
        isActive: true,
      });
    }

    if (platform.id === 'twitter') {
      await ensureTwitterPollingStarted();
      ensureTwitterStreamStarted();
    }
    ensureSchedulerStarted();

    const returnTo = parsed.returnTo && parsed.returnTo.startsWith('/') ? parsed.returnTo : '/accounts';
    const redirect = new URL(returnTo, appBaseUrl);
    redirect.searchParams.set('oauth', 'success');
    redirect.searchParams.set('platform', platform.id);
    return NextResponse.redirect(redirect.toString());
  } catch (error) {
    console.error('[OAuth Callback] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OAuth failed' },
      { status: 500 }
    );
  }
}
