import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import {
  ALL_BUFFER_PLATFORM_IDS,
  getBufferUserSettings,
  upsertBufferUserSettings,
} from '@/lib/buffer-user-settings';

export const runtime = 'nodejs';

const platformEnum = z.enum(ALL_BUFFER_PLATFORM_IDS as [string, ...string[]]);

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  accessToken: z.string().optional(),
  baseUrl: z.string().optional(),
  platforms: z.array(platformEnum).optional(),
  applyToAllAccounts: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getBufferUserSettings(user.id);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[API] Buffer settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load Buffer settings' }, { status: 500 });
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

    const current = await getBufferUserSettings(user.id);
    const nextSettings = {
      enabled: parsed.data.enabled ?? current.enabled,
      accessToken:
        typeof parsed.data.accessToken === 'string'
          ? parsed.data.accessToken
          : current.accessToken,
      platforms: parsed.data.platforms ?? current.platforms,
    };
    if (
      nextSettings.enabled &&
      nextSettings.platforms.length > 0 &&
      String(nextSettings.accessToken || '').trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Buffer access token is required when Buffer is enabled for any platform.' },
        { status: 400 }
      );
    }

    const settings = await upsertBufferUserSettings(user.id, parsed.data);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[API] Buffer settings PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save Buffer settings' }, { status: 500 });
  }
}
