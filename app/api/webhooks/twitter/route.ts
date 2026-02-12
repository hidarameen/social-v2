import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAnyTwitterWebhookSecret } from '@/lib/platform-credentials';

export const runtime = 'nodejs';

// Twitter CRC (Challenge Response Check) validation
export async function GET(req: NextRequest) {
  const crc_token = req.nextUrl.searchParams.get('crc_token');
  
  if (crc_token) {
    const consumerSecret = await getAnyTwitterWebhookSecret();
    if (!consumerSecret) {
      console.error('[TwitterWebhook] Missing webhook secret for CRC');
      return NextResponse.json({ error: 'Missing Twitter webhook secret in DB' }, { status: 500 });
    }

    const hash = crypto
      .createHmac('sha256', consumerSecret)
      .update(crc_token)
      .digest('base64');

    return NextResponse.json({
      response_token: `sha256=${hash}`
    });
  }

  return NextResponse.json({ message: 'Twitter Webhook Endpoint Active' });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[TwitterWebhook] Received event:', JSON.stringify(payload, null, 2));
    
    // Handle tweet_create_events (Account Activity API)
    if (payload.tweet_create_events) {
      const { twitterStream } = await import('@/lib/services/twitter-stream');
      for (const tweet of payload.tweet_create_events) {
        // Adapt AA API payload to handleEvent format or call processing directly
        // The streaming webhook usually uses the Search Stream, 
        // but if the user wants Webhooks, we should bridge it.
        await twitterStream.handleEvent({ data: tweet, includes: payload.includes, matching_rules: [{ tag: 'webhook' }] });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TwitterWebhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
