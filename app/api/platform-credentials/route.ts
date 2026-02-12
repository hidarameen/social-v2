import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import {
  MANAGED_PLATFORM_IDS,
  getUserPlatformCredentialMap,
  sanitizeCredentialPayload,
  upsertPlatformCredential,
} from '@/lib/platform-credentials';

export const runtime = 'nodejs';

const platformEnum = z.enum(MANAGED_PLATFORM_IDS);

const updateSchema = z.object({
  platformId: platformEnum,
  credentials: z.record(z.unknown()),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const platformIdRaw = request.nextUrl.searchParams.get('platformId');
    if (!platformIdRaw) {
      const map = await getUserPlatformCredentialMap(user.id);
      return NextResponse.json({ success: true, credentials: map });
    }

    const parsed = platformEnum.safeParse(platformIdRaw);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid platform id' }, { status: 400 });
    }

    const map = await getUserPlatformCredentialMap(user.id);
    const credentials = sanitizeCredentialPayload(map[parsed.data] ?? {});
    return NextResponse.json({ success: true, platformId: parsed.data, credentials });
  } catch (error) {
    console.error('[API] Platform credentials GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load platform credentials' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    const credentials = await upsertPlatformCredential(
      user.id,
      parsed.data.platformId,
      parsed.data.credentials
    );

    return NextResponse.json({
      success: true,
      platformId: parsed.data.platformId,
      credentials,
    });
  } catch (error) {
    console.error('[API] Platform credentials PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save platform credentials' }, { status: 500 });
  }
}

