import { NextRequest, NextResponse } from 'next/server';
import { ensureTwitterStreamStarted } from '@/lib/services/twitter-stream';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  try {
    await ensureTwitterStreamStarted();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Stream sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to sync stream' },
      { status: 500 }
    );
  }
}
