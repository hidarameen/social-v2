import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getOAuthPlatform } from '@/lib/oauth/platforms';
import { buildBasicAuth, decodeJwtPayload, safeJsonParse } from '@/lib/oauth/utils';
import { triggerBackgroundServicesRefresh } from '@/lib/services/background-services';
import { getOAuthClientCredentials, type ManagedPlatformId } from '@/lib/platform-credentials';
import type { PlatformId } from '@/lib/platforms/types';
import type { OutstandingNetworkId, OutstandingSocialAccount } from '@/lib/platforms/outstanding/types';
import { listOutstandSocialAccounts } from '@/lib/platforms/outstanding/client';
import { getOutstandUserSettings } from '@/lib/outstand-user-settings';

export const runtime = 'nodejs';

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
};

type OAuthStateCookie = {
  state: string;
  codeVerifier?: string;
  userId: string;
  returnTo?: string;
  provider?: 'native' | 'outstanding';
};

const OUTSTAND_NETWORK_BY_PLATFORM: Partial<Record<PlatformId, OutstandingNetworkId>> = {
  twitter: 'x',
  facebook: 'facebook',
  instagram: 'instagram',
  youtube: 'youtube',
  tiktok: 'tiktok',
  telegram: 'telegram',
  linkedin: 'linkedin',
  pinterest: 'pinterest',
  google_business: 'google_business',
  threads: 'threads',
  snapchat: 'snapchat',
  whatsapp: 'whatsapp',
};

function asOutstandPlatformId(value: string): PlatformId | null {
  const platformId = value as PlatformId;
  return OUTSTAND_NETWORK_BY_PLATFORM[platformId] ? platformId : null;
}

function mapOutstandAccountInfo(account: OutstandingSocialAccount): {
  accountId: string;
  accountName: string;
  accountUsername: string;
  profileImageUrl?: string;
} | null {
  const accountId = String(account.id || '').trim();
  if (!accountId) return null;

  const accountUsername = String(account.username || '').trim();
  const accountName = String(account.name || account.username || accountId).trim();
  const profileImageUrl = String(account.avatarUrl || '').trim() || undefined;

  return {
    accountId,
    accountName: accountName || accountId,
    accountUsername: accountUsername || accountName || accountId,
    profileImageUrl,
  };
}

async function exchangeToken(
  userId: string,
  platformId: string,
  code: string,
  redirectUri: string,
  codeVerifier?: string
) {
  const platform = getOAuthPlatform(platformId);
  if (!platform?.tokenUrl) throw new Error('Missing token URL');
  const { clientId, clientSecret } = await getOAuthClientCredentials(userId, platform.id as ManagedPlatformId);

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
      if (!clientSecret) throw new Error('Missing Facebook client secret in platform credentials');
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('redirect_uri', redirectUri);
      body.set('code', code);
      break;
    }
    case 'instagram': {
      if (!clientSecret) throw new Error('Missing Instagram client secret in platform credentials');
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('grant_type', 'authorization_code');
      body.set('redirect_uri', redirectUri);
      body.set('code', code);
      break;
    }
    case 'youtube': {
      if (!clientSecret) throw new Error('Missing YouTube client secret in platform credentials');
      body.set('client_id', clientId);
      body.set('client_secret', clientSecret);
      body.set('code', code);
      body.set('redirect_uri', redirectUri);
      body.set('grant_type', 'authorization_code');
      break;
    }
    case 'tiktok': {
      if (!clientSecret) throw new Error('Missing TikTok client secret in platform credentials');
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
      const res = await fetch('https://api.x.com/2/users/me?user.fields=profile_image_url', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.data
        ? {
            id: data.data.id,
            username: data.data.username,
            name: data.data.name,
            profileImageUrl: data.data.profile_image_url,
          }
        : null;
    }
    case 'facebook': {
      if (!accessToken) return null;
      let me: any = null;
      try {
        const meRes = await fetch(
          `https://graph.facebook.com/v22.0/me?fields=id,name,picture.width(256).height(256)&access_token=${encodeURIComponent(accessToken)}`
        );
        if (meRes.ok) {
          me = await meRes.json();
        }
      } catch {
        me = null;
      }

      let pages: Array<{
        id: string;
        name: string;
        accessToken?: string;
        profileImageUrl?: string;
        followers?: number;
      }> = [];
      try {
        const pagesRes = await fetch(
          `https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token,picture.width(256).height(256),fan_count&limit=200&access_token=${encodeURIComponent(accessToken)}`
        );
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          pages = Array.isArray(pagesData?.data)
            ? pagesData.data
                .map((page: any) => ({
                  id: page?.id ? String(page.id) : '',
                  name: page?.name ? String(page.name) : '',
                  accessToken: page?.access_token ? String(page.access_token) : undefined,
                  profileImageUrl: page?.picture?.data?.url ? String(page.picture.data.url) : undefined,
                  followers:
                    typeof page?.fan_count === 'number' && Number.isFinite(page.fan_count)
                      ? page.fan_count
                      : undefined,
                }))
                .filter((page: { id: string; name: string }) => page.id.length > 0 && page.name.length > 0)
            : [];
        }
      } catch {
        pages = [];
      }

      if (pages.length === 0 && !me?.id) return null;
      return {
        id: me?.id || pages[0]?.id,
        name: me?.name || pages[0]?.name || 'Facebook',
        profileImageUrl: me?.picture?.data?.url || pages[0]?.profileImageUrl,
        pages,
      };
    }
    case 'instagram': {
      if (!accessToken) return null;
      const res = await fetch(`https://graph.instagram.com/me?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.id
        ? {
            id: data.id,
            username: data.username,
            name: data.username,
            profileImageUrl: data.profile_picture_url,
          }
        : null;
    }
    case 'youtube': {
      if (accessToken) {
        try {
          const channelsRes = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true&maxResults=50',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (channelsRes.ok) {
            const channelsData = await channelsRes.json();
            const channels = Array.isArray(channelsData?.items)
              ? channelsData.items
                  .map((item: any) => ({
                    id: item?.id ? String(item.id) : '',
                    title: item?.snippet?.title ? String(item.snippet.title) : '',
                    customUrl: item?.snippet?.customUrl ? String(item.snippet.customUrl) : undefined,
                    avatarUrl:
                      item?.snippet?.thumbnails?.high?.url ||
                      item?.snippet?.thumbnails?.medium?.url ||
                      item?.snippet?.thumbnails?.default?.url,
                  }))
                  .filter((item: { id: string }) => item.id.length > 0)
              : [];

            let playlists: Array<{
              id: string;
              title: string;
              description?: string;
              itemCount?: number;
              channelId?: string;
            }> = [];

            try {
              const playlistsRes = await fetch(
                'https://www.googleapis.com/youtube/v3/playlists?part=id,snippet,contentDetails&mine=true&maxResults=50',
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }
              );
              if (playlistsRes.ok) {
                const playlistsData = await playlistsRes.json();
                playlists = Array.isArray(playlistsData?.items)
                  ? playlistsData.items
                      .map((item: any) => ({
                        id: item?.id ? String(item.id) : '',
                        title: item?.snippet?.title ? String(item.snippet.title) : '',
                        description: item?.snippet?.description
                          ? String(item.snippet.description)
                          : undefined,
                        itemCount:
                          typeof item?.contentDetails?.itemCount === 'number'
                            ? item.contentDetails.itemCount
                            : undefined,
                        channelId: item?.snippet?.channelId
                          ? String(item.snippet.channelId)
                          : undefined,
                      }))
                      .filter((item: { id: string; title: string }) => item.id.length > 0 && item.title.length > 0)
                  : [];
              }
            } catch {
              playlists = [];
            }

            if (channels.length > 0) {
              const primary = channels[0];
              const username = primary.customUrl || primary.title || primary.id;
              return {
                id: primary.id,
                username,
                name: primary.title || username,
                profileImageUrl: primary.avatarUrl,
                channels,
                playlists,
              };
            }
          }
        } catch {
          // Fall back to id_token identity below.
        }
      }

      const payload = decodeJwtPayload(tokenResponse?.id_token);
      if (!payload) return null;
      return {
        id: payload.sub,
        username: payload.email,
        name: payload.name || payload.email,
        profileImageUrl: payload.picture,
      };
    }
    case 'tiktok': {
      if (accessToken && tokenResponse?.open_id) {
        try {
          const infoRes = await fetch(
            'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url',
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            const user = infoData?.data?.user;
            if (user?.open_id) {
              return {
                id: user.open_id,
                username: user.username || user.open_id,
                name: user.display_name || user.username || 'TikTok Account',
                profileImageUrl: user.avatar_url,
              };
            }
          }
        } catch {
          // Fallback below.
        }
      }
      if (tokenResponse?.open_id) {
        return {
          id: tokenResponse.open_id,
          username: tokenResponse.open_id,
          name: 'TikTok Account',
        };
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

    const cookieStore = await cookies();
    const raw = cookieStore.get(`oauth_state_${platform.id}`)?.value;
    if (!raw) {
      return NextResponse.json({ success: false, error: 'Missing OAuth state cookie' }, { status: 400 });
    }
    const parsed = safeJsonParse<OAuthStateCookie>(raw);
    if (!parsed || parsed.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Invalid OAuth state' }, { status: 400 });
    }

    const search = request.nextUrl.searchParams;
    const state = search.get('state');
    if (state && parsed.state !== state) {
      return NextResponse.json({ success: false, error: 'Invalid OAuth state' }, { status: 400 });
    }
    cookieStore.delete(`oauth_state_${platform.id}`);

    const appBaseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
    const returnTo = parsed.returnTo && parsed.returnTo.startsWith('/') ? parsed.returnTo : '/accounts';
    const provider = parsed.provider === 'outstanding' ? 'outstanding' : 'native';

    if (provider === 'outstanding') {
      const platformId = asOutstandPlatformId(platform.id);
      if (!platformId) {
        return NextResponse.json({ success: false, error: 'Unsupported Outstand platform' }, { status: 400 });
      }

      const outstandSettings = await getOutstandUserSettings(user.id);
      if (!outstandSettings.apiKey) {
        return NextResponse.json(
          { success: false, error: 'Missing Outstand API key. Add it in Settings before connecting accounts.' },
          { status: 400 }
        );
      }

      const network = OUTSTAND_NETWORK_BY_PLATFORM[platformId];
      const outstandAccounts = await listOutstandSocialAccounts({
        network,
        limit: 200,
        tenantId: outstandSettings.tenantId,
        apiKey: outstandSettings.apiKey,
        baseUrl: outstandSettings.baseUrl,
      });

      if (outstandAccounts.length === 0) {
        throw new Error(`No ${platform.name} accounts found in Outstand. Complete authorization and try again.`);
      }

      const userAccounts = await db.getUserAccounts(user.id);
      let linkedCount = 0;
      for (const outstandAccount of outstandAccounts) {
        const mapped = mapOutstandAccountInfo(outstandAccount);
        if (!mapped) continue;

        const existing = userAccounts.find(
          (item) => item.platformId === platform.id && String(item.accountId) === mapped.accountId
        );

        const nextCredentials = {
          ...(existing?.credentials || {}),
          authProvider: 'outstanding',
          outstandManaged: true,
          outstandAccount: {
            id: mapped.accountId,
            username: mapped.accountUsername,
            name: mapped.accountName,
            avatarUrl: mapped.profileImageUrl,
            network,
          },
          profileImageUrl: mapped.profileImageUrl,
        };

        if (existing) {
          await db.updateAccount(existing.id, {
            accountName: mapped.accountName,
            accountUsername: mapped.accountUsername,
            accessToken: existing.accessToken || 'outstand',
            refreshToken: existing.refreshToken,
            credentials: nextCredentials,
            isActive: true,
          });
        } else {
          await db.createAccount({
            id: randomUUID(),
            userId: user.id,
            platformId: platform.id,
            accountName: mapped.accountName,
            accountUsername: mapped.accountUsername,
            accountId: mapped.accountId,
            accessToken: 'outstand',
            refreshToken: undefined,
            credentials: nextCredentials,
            isActive: true,
          });
        }

        linkedCount += 1;
      }

      if (linkedCount === 0) {
        throw new Error(`No valid ${platform.name} accounts were returned by Outstand.`);
      }

      triggerBackgroundServicesRefresh({ force: platform.id === 'twitter' });
      const redirect = new URL(returnTo, appBaseUrl);
      redirect.searchParams.set('oauth', 'success');
      redirect.searchParams.set('platform', platform.id);
      redirect.searchParams.set('provider', 'outstanding');
      return NextResponse.redirect(redirect.toString());
    }

    if (!platform.authUrl || !platform.tokenUrl) {
      return NextResponse.json(
        { success: false, error: `${platform.name} does not support OAuth in this app` },
        { status: 400 }
      );
    }

    const code = search.get('code');
    if (!code || !state || parsed.state !== state) {
      return NextResponse.json({ success: false, error: 'Missing code or state' }, { status: 400 });
    }

    const redirectUri = `${appBaseUrl}/api/oauth/${platform.id}/callback`;
    const tokenResponse = await exchangeToken(user.id, platform.id, code, redirectUri, parsed.codeVerifier);
    const accessToken = tokenResponse.access_token;
    const refreshToken = tokenResponse.refresh_token;

    const accountInfo = await fetchAccountInfo(platform.id, accessToken, tokenResponse);
    const userAccounts = await db.getUserAccounts(user.id);

    if (platform.id === 'facebook') {
      const pages = Array.isArray((accountInfo as any)?.pages)
        ? (accountInfo as any).pages.filter((page: any) => page?.id && page?.name)
        : [];

      if (pages.length === 0) {
        throw new Error(
          'No Facebook Pages were returned for this account. Ensure pages_show_list and pages_manage_posts permissions are approved, then reconnect.'
        );
      }

      for (const page of pages) {
        const pageId = String(page.id);
        const pageName = String(page.name);
        const pageToken = String(page.accessToken || accessToken || '').trim();
        if (!pageToken) continue;

        const existing = userAccounts.find(
          (item) => item.platformId === 'facebook' && String(item.accountId) === pageId
        );
        const profileImageUrl = page.profileImageUrl || (accountInfo as any)?.profileImageUrl;
        const pageAccountInfo = {
          id: pageId,
          name: pageName,
          profileImageUrl,
          followers: page.followers,
        };
        const nextCredentials = {
          ...(existing?.credentials || {}),
          tokenResponse,
          accountInfo: pageAccountInfo,
          profileImageUrl,
          pageId,
          pageName,
          pageAccessToken: pageToken,
          oauthUser: {
            id: (accountInfo as any)?.id,
            name: (accountInfo as any)?.name,
            profileImageUrl: (accountInfo as any)?.profileImageUrl,
          },
          availablePages: pages.map((item: any) => ({
            id: String(item.id || ''),
            name: String(item.name || ''),
            profileImageUrl: item.profileImageUrl ? String(item.profileImageUrl) : undefined,
            followers:
              typeof item.followers === 'number' && Number.isFinite(item.followers)
                ? item.followers
                : undefined,
          })),
        };

        if (existing) {
          await db.updateAccount(existing.id, {
            accountName: pageName,
            accountUsername: pageName,
            accessToken: pageToken,
            refreshToken: refreshToken || existing.refreshToken,
            credentials: nextCredentials,
            isActive: true,
          });
          continue;
        }

        await db.createAccount({
          id: randomUUID(),
          userId: user.id,
          platformId: 'facebook',
          accountName: pageName,
          accountUsername: pageName,
          accountId: pageId,
          accessToken: pageToken,
          refreshToken: refreshToken,
          credentials: nextCredentials,
          isActive: true,
        });
      }
    } else {
      const accountId = accountInfo?.id || `${platform.id}_${Date.now()}`;
      const accountName = accountInfo?.name || `${platform.name} Account`;
      const accountUsername = accountInfo?.username || accountName;
      const profileImageUrl = (accountInfo as any)?.profileImageUrl;

      const existing = userAccounts.find(
        a => a.platformId === platform.id && a.accountId === accountId
      );
      if (existing) {
        const youtubeChannels =
          platform.id === 'youtube' && Array.isArray((accountInfo as any)?.channels)
            ? (accountInfo as any).channels
            : undefined;
        const youtubePlaylists =
          platform.id === 'youtube' && Array.isArray((accountInfo as any)?.playlists)
            ? (accountInfo as any).playlists
            : undefined;
        await db.updateAccount(existing.id, {
          accountName,
          accountUsername,
          accessToken: accessToken || existing.accessToken,
          refreshToken: refreshToken || existing.refreshToken,
          credentials: {
            ...(existing.credentials || {}),
            tokenResponse,
            accountInfo,
            profileImageUrl,
            ...(platform.id === 'youtube'
              ? {
                  channelId: accountInfo?.id,
                  selectedChannelId: accountInfo?.id,
                  availableChannels: youtubeChannels,
                  availablePlaylists: youtubePlaylists,
                }
              : {}),
          },
          isActive: true,
        });
      } else {
        const youtubeChannels =
          platform.id === 'youtube' && Array.isArray((accountInfo as any)?.channels)
            ? (accountInfo as any).channels
            : undefined;
        const youtubePlaylists =
          platform.id === 'youtube' && Array.isArray((accountInfo as any)?.playlists)
            ? (accountInfo as any).playlists
            : undefined;
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
            profileImageUrl,
            ...(platform.id === 'youtube'
              ? {
                  channelId: accountInfo?.id,
                  selectedChannelId: accountInfo?.id,
                  availableChannels: youtubeChannels,
                  availablePlaylists: youtubePlaylists,
                }
              : {}),
          },
          isActive: true,
        });
      }
    }

    triggerBackgroundServicesRefresh({ force: platform.id === 'twitter' });

    const redirect = new URL(returnTo, appBaseUrl);
    redirect.searchParams.set('oauth', 'success');
    redirect.searchParams.set('platform', platform.id);
    redirect.searchParams.set('provider', 'native');
    return NextResponse.redirect(redirect.toString());
  } catch (error) {
    console.error('[OAuth Callback] Error:', error);
    const message = error instanceof Error ? error.message : 'OAuth failed';
    const status = message.toLowerCase().includes('missing') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
