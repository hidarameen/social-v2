import { NextRequest, NextResponse } from 'next/server';
import { twitterPoller } from '@/lib/services/twitter-poller';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  try {
    await twitterPoller.runOnce();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Poll now error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to poll' },
      { status: 500 }
    );
  }
}
