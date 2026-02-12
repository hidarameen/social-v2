import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';

async function revokeFacebookAppPermissions(userAccessToken: string): Promise<void> {
  const token = String(userAccessToken || '').trim();
  if (!token) return;
  try {
    await fetch(
      `https://graph.facebook.com/v22.0/me/permissions?access_token=${encodeURIComponent(token)}`,
      { method: 'DELETE' }
    );
  } catch {
    // Best effort only.
  }
}


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid account id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const current = await db.getAccount(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const schema = z.object({
      platformId: z.string().min(1).optional(),
      accountName: z.string().min(1).optional(),
      accountUsername: z.string().optional(),
      accountId: z.string().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      credentials: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const body = parsed.data;
    const updated = await db.updateAccount(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, account: updated });
  } catch (error) {
    console.error('[API] Error updating account:', error);
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid account id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const current = await db.getAccount(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const shouldTryFacebookRevoke = current.platformId === 'facebook';
    const currentCredentials = (current.credentials || {}) as Record<string, any>;
    const oauthUserId = String(currentCredentials?.oauthUser?.id || '').trim();
    const tokenFromTokenResponse = String(currentCredentials?.tokenResponse?.access_token || '').trim();
    const tokenFromOauthUserToken = String(currentCredentials?.oauthUserAccessToken || '').trim();
    const revokeToken = tokenFromOauthUserToken || tokenFromTokenResponse;

    const deleted = await db.deleteAccount(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    if (shouldTryFacebookRevoke && revokeToken) {
      const remainingAccounts = await db.getUserAccounts(user.id);
      const hasSameFacebookIdentity = remainingAccounts.some((account) => {
        if (account.platformId !== 'facebook') return false;
        const creds = (account.credentials || {}) as Record<string, any>;
        const otherOauthUserId = String(creds?.oauthUser?.id || '').trim();
        return oauthUserId.length > 0 && otherOauthUserId === oauthUserId;
      });
      if (!hasSameFacebookIdentity) {
        await revokeFacebookAppPermissions(revokeToken);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting account:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
