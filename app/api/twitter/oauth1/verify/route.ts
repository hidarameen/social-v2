import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { TwitterClient } from '@/platforms/twitter/client';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const client = new TwitterClient(process.env.TWITTER_BEARER_TOKEN || '');
  const result = await client.verifyOAuth1();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error, body: result.body }, { status: 400 });
  }

  return NextResponse.json({ success: true, body: result.body });
}
