import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { TelegramClient } from '@/platforms/telegram/client';

function computeCrcResponse(crcToken: string, secret: string) {
  const hash = createHmac('sha256', secret).update(crcToken).digest('base64');
  return `sha256=${hash}`;
}

function verifySignature(body: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const hash = createHmac('sha256', secret).update(body).digest('base64');
  const expected = `sha256=${hash}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

type TwitterWebhookTweet = {
  id_str: string;
  text?: string;
  created_at?: string;
  in_reply_to_status_id_str?: string | null;
  is_quote_status?: boolean;
  retweeted_status?: any;
  user?: { id_str?: string; name?: string; screen_name?: string };
  entities?: { media?: Array<{ type?: string; media_url_https?: string; video_info?: any }> };
};

export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get('crc_token');
  const secret = process.env.TWITTER_WEBHOOK_SECRET || process.env.TWITTER_CLIENT_SECRET;
  if (!crcToken || !secret) {
    return NextResponse.json({ error: 'Missing crc_token or webhook secret' }, { status: 400 });
  }
  return NextResponse.json({ response_token: computeCrcResponse(crcToken, secret) });
}

export async function POST(request: NextRequest) {
  const secret = process.env.TWITTER_WEBHOOK_SECRET || process.env.TWITTER_CLIENT_SECRET;
  const rawBody = await request.text();
  if (secret) {
    const signature = request.headers.get('x-twitter-webhooks-signature');
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const forUserId = payload.for_user_id;
  if (!forUserId) {
    return NextResponse.json({ ok: true });
  }

  const accounts = await db.getAllAccounts();
  const sourceAccount = accounts.find(
    a => a.platformId === 'twitter' && a.accountId === String(forUserId) && a.isActive
  );
  if (!sourceAccount) {
    return NextResponse.json({ ok: true });
  }

  const tweets: TwitterWebhookTweet[] = payload.tweet_create_events || [];
  if (tweets.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const userTasks = await db.getUserTasks(sourceAccount.userId);
  const activeTasks = userTasks.filter(
    t => t.status === 'active' && t.sourceAccounts.includes(sourceAccount.id)
  );
  if (activeTasks.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const userAccounts = await db.getUserAccounts(sourceAccount.userId);
  const accountsById = new Map(userAccounts.map(a => [a.id, a]));

  for (const task of activeTasks) {
    const filters = task.filters || {};
    const targets = task.targetAccounts
      .map(id => accountsById.get(id))
      .filter((a): a is typeof sourceAccount => Boolean(a))
      .filter(a => a.isActive && a.platformId === 'telegram');

    for (const tweet of tweets) {
      const isReply = Boolean(tweet.in_reply_to_status_id_str);
      const isRetweet = Boolean(tweet.retweeted_status);
      const isQuote = Boolean(tweet.is_quote_status);

      if (filters.originalOnly && (isReply || isRetweet || isQuote)) continue;
      if (filters.excludeReplies && isReply) continue;
      if (filters.excludeRetweets && isRetweet) continue;
      if (filters.excludeQuotes && isQuote) continue;

      const username = tweet.user?.screen_name || sourceAccount.credentials?.accountInfo?.username || '';
      const name = tweet.user?.name || sourceAccount.credentials?.accountInfo?.name || '';
      const link = username ? `https://twitter.com/${username}/status/${tweet.id_str}` : `https://twitter.com/i/web/status/${tweet.id_str}`;
      const date = tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString();
      const mediaUrls =
        tweet.entities?.media?.map(m => m.media_url_https).filter(Boolean).join('\n') || '';

      const template =
        task.transformations?.template?.trim() ||
        `%name% (@%username%)\n%date%\n%text%\n%link%`;

      const message = template
        .replace(/%text%/g, tweet.text || '')
        .replace(/%username%/g, username)
        .replace(/%name%/g, name)
        .replace(/%date%/g, date)
        .replace(/%link%/g, link)
        .replace(/%media%/g, mediaUrls)
        .trim();

      const includeMedia = task.transformations?.includeMedia !== false;

      for (const target of targets) {
        let status: 'success' | 'failed' = 'success';
        let errorMessage: string | undefined;

        try {
          const chatId = target.credentials?.chatId;
          if (!chatId) throw new Error('Missing Telegram target chat ID');
          const client = new TelegramClient(target.accessToken);
          if (!includeMedia || !tweet.entities?.media || tweet.entities.media.length === 0) {
            await client.sendMessage(String(chatId), message);
          } else {
            const firstMedia = tweet.entities.media[0];
            if (firstMedia?.media_url_https) {
              await client.sendPhoto(String(chatId), firstMedia.media_url_https, message);
            } else {
              await client.sendMessage(String(chatId), message);
            }
          }
        } catch (error) {
          status = 'failed';
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }

        await db.createExecution({
          taskId: task.id,
          sourceAccount: sourceAccount.id,
          targetAccount: target.id,
          originalContent: tweet.text || '',
          transformedContent: message,
          status,
          error: errorMessage,
          executedAt: new Date(),
          responseData: { sourceTweetId: tweet.id_str, sourceUsername: username },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
