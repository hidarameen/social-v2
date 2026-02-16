import { NextResponse } from 'next/server';

import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image ?? null,
      },
    });
  } catch (error) {
    console.error('[API] mobile me error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resolve user' }, { status: 500 });
  }
}
