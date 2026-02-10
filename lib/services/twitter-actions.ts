import type { PlatformAccount } from '@/lib/db';
import { TwitterClient } from '@/platforms/twitter/client';
import { buildMessage, clampTweetText, normalizeTwitterActions, type TweetItem, type TwitterActionConfig } from '@/lib/services/twitter-utils';

type ActionResult = {
  ok: boolean;
  error?: string;
  results: Record<string, any>;
  textUsed?: string;
};

export async function executeTwitterActions(params: {
  target: PlatformAccount;
  tweet: TweetItem;
  template?: string;
  accountInfo?: { username?: string; name?: string };
  actions?: TwitterActionConfig;
}): Promise<ActionResult> {
  const { target, tweet, template, accountInfo, actions } = params;
  const normalized = normalizeTwitterActions(actions);
  const client = new TwitterClient(target.accessToken);
  const message = buildMessage(template, tweet, accountInfo).trim();
  const text = clampTweetText(message || tweet.text || '');

  const needsText = Boolean(normalized.post || normalized.reply || normalized.quote);
  if (needsText && !text) {
    return { ok: false, error: 'Tweet text is empty', results: {} };
  }

  const results: Record<string, any> = {};
  const errors: string[] = [];

  if (normalized.post) {
    try {
      results.post = await client.tweet({ text });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to post tweet');
    }
  }

  if (normalized.reply) {
    try {
      results.reply = await client.replyTweet(text, tweet.id);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to reply to tweet');
    }
  }

  if (normalized.quote) {
    try {
      results.quote = await client.quoteTweet(text, tweet.id);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to quote tweet');
    }
  }

  if (normalized.retweet) {
    if (!target.accountId) {
      errors.push('Missing Twitter target account ID for retweet');
    } else {
      const ok = await client.retweet(target.accountId, tweet.id);
      if (!ok) errors.push('Failed to retweet');
      results.retweet = ok;
    }
  }

  if (normalized.like) {
    if (!target.accountId) {
      errors.push('Missing Twitter target account ID for like');
    } else {
      const ok = await client.likeTweet(target.accountId, tweet.id);
      if (!ok) errors.push('Failed to like tweet');
      results.like = ok;
    }
  }

  return {
    ok: errors.length === 0,
    error: errors.length ? errors.join('; ') : undefined,
    results,
    textUsed: text,
  };
}
