import { NextRequest, NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { logServerError, logServerWarn } from '@/lib/server-logger';

export const runtime = 'nodejs';

function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || crypto.randomUUID();
}

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  profileImageUrl: z.union([z.string().max(2_000_000), z.literal(''), z.null()]).optional(),
  currentPassword: z.string().min(1).max(256).optional(),
  newPassword: z.string().min(8).max(256).optional(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      logServerWarn('api.profile.get', 'Unauthorized profile fetch', { requestId });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const current = await db.getUser(user.id);
    if (!current) {
      logServerWarn('api.profile.get', 'Profile user not found', { requestId, userId: user.id });
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: current.id,
        email: current.email,
        name: current.name,
        profileImageUrl: current.profileImageUrl || null,
      },
    });
  } catch (error) {
    logServerError('api.profile.get', 'Profile GET failed', error, { requestId });
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      logServerWarn('api.profile.patch', 'Unauthorized profile update', { requestId });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = updateProfileSchema.safeParse(await request.json());
    if (!parsed.success) {
      logServerWarn('api.profile.patch', 'Invalid profile payload', {
        requestId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const current = await db.getUser(user.id);
    if (!current) {
      logServerWarn('api.profile.patch', 'Profile user not found', { requestId, userId: user.id });
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { name, profileImageUrl, currentPassword, newPassword } = parsed.data;
    const wantsPasswordUpdate = Boolean(currentPassword || newPassword);

    if (wantsPasswordUpdate) {
      if (!currentPassword || !newPassword) {
        logServerWarn('api.profile.patch', 'Password update payload incomplete', { requestId, userId: user.id });
        return NextResponse.json(
          { success: false, error: 'Current password and new password are required' },
          { status: 400 }
        );
      }

      if (!current.passwordHash) {
        logServerWarn('api.profile.patch', 'Password update unavailable: no local hash', { requestId, userId: user.id });
        return NextResponse.json(
          { success: false, error: 'Password update is not available for this account' },
          { status: 400 }
        );
      }

      const valid = await compare(currentPassword, current.passwordHash);
      if (!valid) {
        logServerWarn('api.profile.patch', 'Password update rejected: invalid current password', {
          requestId,
          userId: user.id,
        });
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    const updates: any = {};

    if (typeof name === 'string') {
      updates.name = name.trim();
    }

    if (profileImageUrl !== undefined) {
      const normalized = typeof profileImageUrl === 'string' ? profileImageUrl.trim() : '';
      updates.profileImageUrl = normalized.length > 0 ? normalized : undefined;
    }

    if (wantsPasswordUpdate && newPassword) {
      updates.passwordHash = await hash(newPassword, 12);
    }

    const updated = await db.updateUser(user.id, updates);
    if (!updated) {
      logServerError('api.profile.patch', 'db.updateUser returned empty result', undefined, {
        requestId,
        userId: user.id,
      });
      return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        profileImageUrl: updated.profileImageUrl || null,
      },
      passwordUpdated: wantsPasswordUpdate,
    });
  } catch (error) {
    logServerError('api.profile.patch', 'Profile PATCH failed', error, { requestId });
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
