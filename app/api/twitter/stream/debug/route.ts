import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const bearer = process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) {
    return NextResponse.json({ success: false, error: 'Missing TWITTER_BEARER_TOKEN' }, { status: 400 });
  }

  const params = new URLSearchParams({
    'tweet.fields': 'created_at,attachments,referenced_tweets,author_id',
    expansions: 'attachments.media_keys,author_id',
    'media.fields': 'type,url,preview_image_url',
    'user.fields': 'username,name',
  });

  const res = await fetch(`https://api.twitter.com/2/tweets/search/stream?${params.toString()}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ success: false, error: res.statusText }, { status: 500 });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const deadline = Date.now() + 30_000;
  let buffer = '';
  const events: any[] = [];

  while (Date.now() < deadline && events.length < 3) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
        if (events.length >= 3) break;
      } catch {
        // ignore parse errors
      }
    }
  }

  return NextResponse.json({ success: true, received: events.length, events });
}
