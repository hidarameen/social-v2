import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { TwitterClient } from '@/platforms/twitter/client';
import { getTwitterOAuth1CredentialsForUser } from '@/lib/platform-credentials';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const oauth1Credentials = await getTwitterOAuth1CredentialsForUser(user.id);
  if (!oauth1Credentials) {
    return NextResponse.json(
      { success: false, error: 'Missing Twitter OAuth1 credentials in Settings.' },
      { status: 400 }
    );
  }

  const client = new TwitterClient('', { oauth1Credentials });
  const result = await client.verifyOAuth1();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error, body: result.body }, { status: 400 });
  }

  return NextResponse.json({ success: true, body: result.body });
}
