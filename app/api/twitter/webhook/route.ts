import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { buildMessage, buildTweetLink, sendToTelegram, type TweetItem } from '@/lib/services/twitter-utils';
import { executeTwitterActions } from '@/lib/services/twitter-actions';
import { debugLog, debugError } from '@/lib/debug';

export const runtime = 'nodejs';

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
  // X uses the app "Consumer Secret" (API Secret) for CRC/signatures
  const secret =
    process.env.TWITTER_API_SECRET ||
    process.env.TWITTER_WEBHOOK_SECRET ||
    process.env.TWITTER_CLIENT_SECRET;
  if (!crcToken || !secret) {
    return NextResponse.json({ error: 'Missing crc_token or webhook secret' }, { status: 400 });
  }
  return NextResponse.json({ response_token: computeCrcResponse(crcToken, secret) });
}

export async function POST(request: NextRequest) {
  // X uses the app "Consumer Secret" (API Secret) for CRC/signatures
  const secret =
    process.env.TWITTER_API_SECRET ||
    process.env.TWITTER_WEBHOOK_SECRET ||
    process.env.TWITTER_CLIENT_SECRET;
  const rawBody = await request.text();
  if (secret) {
    const signature = request.headers.get('x-twitter-webhooks-signature');
    if (!verifySignature(rawBody, signature, secret)) {
      debugLog('Twitter webhook ignored: invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    debugLog('Twitter webhook invalid payload');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const forUserId = payload.for_user_id;
  if (!forUserId) {
    debugLog('Twitter webhook ignored: missing for_user_id');
    return NextResponse.json({ ok: true });
  }

  const accounts = await db.getAllAccounts();
  const sourceAccount = accounts.find(
    a => a.platformId === 'twitter' && a.accountId === String(forUserId) && a.isActive
  );
  if (!sourceAccount) {
    debugLog('Twitter webhook ignored: source account not found', { forUserId });
    return NextResponse.json({ ok: true });
  }

  const tweets: TwitterWebhookTweet[] = payload.tweet_create_events || [];
  if (tweets.length === 0) {
    debugLog('Twitter webhook ignored: no tweets');
    return NextResponse.json({ ok: true });
  }

  const userTasks = await db.getUserTasks(sourceAccount.userId);
  const activeTasks = userTasks.filter(
    t => t.status === 'active' && t.sourceAccounts.includes(sourceAccount.id)
  );
  if (activeTasks.length === 0) {
    debugLog('Twitter webhook ignored: no active tasks', { userId: sourceAccount.userId });
    return NextResponse.json({ ok: true });
  }

  const userAccounts = await db.getUserAccounts(sourceAccount.userId);
  const accountsById = new Map(userAccounts.map(a => [a.id, a]));

  for (const task of activeTasks) {
    const filters = task.filters || {};
    const targets = task.targetAccounts
      .map(id => accountsById.get(id))
      .filter((a): a is typeof sourceAccount => Boolean(a))
      .filter(a => a.isActive);

    for (const tweet of tweets) {
      debugLog('Twitter webhook tweet received', { tweetId: tweet.id_str });
      const triggerType = filters.triggerType || 'on_tweet';
      if (
        triggerType === 'on_like' ||
        triggerType === 'on_search' ||
        triggerType === 'on_keyword' ||
        triggerType === 'on_hashtag' ||
        triggerType === 'on_mention'
      ) {
        continue;
      }

      const isReply = Boolean(tweet.in_reply_to_status_id_str);
      const isRetweet = Boolean(tweet.retweeted_status);
      const isQuote = Boolean(tweet.is_quote_status);

      if (triggerType === 'on_retweet' && !isRetweet) continue;

      const effectiveOriginalOnly = triggerType === 'on_retweet' ? false : Boolean(filters.originalOnly);
      const effectiveExcludeReplies = Boolean(filters.excludeReplies);
      const effectiveExcludeRetweets = triggerType === 'on_retweet' ? false : Boolean(filters.excludeRetweets);
      const effectiveExcludeQuotes = Boolean(filters.excludeQuotes);

      if (effectiveOriginalOnly && (isReply || isRetweet || isQuote)) continue;
      if (effectiveExcludeReplies && isReply) continue;
      if (effectiveExcludeRetweets && isRetweet) continue;
      if (effectiveExcludeQuotes && isQuote) continue;

      const username = tweet.user?.screen_name || sourceAccount.credentials?.accountInfo?.username || '';
      const name = tweet.user?.name || sourceAccount.credentials?.accountInfo?.name || '';
      const link = buildTweetLink(username, tweet.id_str);
      const date = tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString();

      const media =
        tweet.entities?.media?.map(m => ({
          type: m.type || 'photo',
          url: m.media_url_https,
        })).filter(m => m.url) || [];

      const tweetItem: TweetItem = {
        id: tweet.id_str,
        text: tweet.text || '',
        createdAt: date,
        referencedTweets: [],
        media: media as any,
        author: { username, name },
      };

      const message = buildMessage(task.transformations?.template, tweetItem, {
        username,
        name,
      });
      const includeMedia = task.transformations?.includeMedia !== false;
      const enableYtDlp = task.transformations?.enableYtDlp === true;

      for (const target of targets) {
        let status: 'success' | 'failed' = 'success';
        let errorMessage: string | undefined;
        let responseData: Record<string, any> = { sourceTweetId: tweet.id_str, sourceUsername: username };

        try {
          if (target.platformId === 'telegram') {
            debugLog('Twitter webhook -> Telegram start', { taskId: task.id, targetId: target.id });
            const chatId = target.credentials?.chatId;
            if (!chatId) throw new Error('Missing Telegram target chat ID');
            await sendToTelegram(
              target.accessToken,
              String(chatId),
              message,
              tweetItem.media,
              includeMedia,
              link,
              enableYtDlp
            );
            debugLog('Twitter webhook -> Telegram sent', { taskId: task.id, targetId: target.id });
          } else if (target.platformId === 'twitter') {
            debugLog('Twitter webhook -> Twitter actions start', { taskId: task.id, targetId: target.id });
            const actionResult = await executeTwitterActions({
              target,
              tweet: tweetItem,
              template: task.transformations?.template,
              accountInfo: { username, name },
              actions: task.transformations?.twitterActions,
            });
            responseData = { ...responseData, actions: actionResult.results, textUsed: actionResult.textUsed };
            if (!actionResult.ok) {
              throw new Error(actionResult.error || 'Twitter actions failed');
            }
            debugLog('Twitter webhook -> Twitter actions success', { taskId: task.id, targetId: target.id });
          } else {
            continue;
          }
        } catch (error) {
          status = 'failed';
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
          debugError('Twitter webhook target failed', error, { taskId: task.id, targetId: target.id });
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
          responseData,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
