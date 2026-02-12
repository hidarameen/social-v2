import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth';
import { getOAuthPlatform } from '@/lib/oauth/platforms';
import { generateCodeChallenge, generateCodeVerifier, generateState } from '@/lib/oauth/utils';
import { getOAuthClientCredentials } from '@/lib/platform-credentials';

export const runtime = 'nodejs';


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
    return NextResponse.json(
      { success: false, error: `${platform.name} does not support OAuth in this app` },
      { status: 400 }
    );
  }

  let clientId: string;
  try {
    ({ clientId } = await getOAuthClientCredentials(user.id, platform.id));
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Missing OAuth credentials' },
      { status: 400 }
    );
  }

  const state = generateState();
  const codeVerifier = platform.usePKCE ? generateCodeVerifier() : undefined;
  const codeChallenge = codeVerifier ? generateCodeChallenge(codeVerifier) : undefined;
  const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
  const redirectUri = `${baseUrl}/api/oauth/${platform.id}/callback`;
  const returnTo = request.nextUrl.searchParams.get('returnTo') || '/accounts';

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

  const cookieStore = await cookies();
  cookieStore.set({
    name: `oauth_state_${platform.id}`,
    value: JSON.stringify({
      state,
      codeVerifier,
      userId: user.id,
      returnTo,
    }),
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 10 * 60,
  });

  const authUrl = `${platform.authUrl}?${paramsOut.toString()}`;
  return NextResponse.redirect(authUrl);
}
