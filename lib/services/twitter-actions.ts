import { db, type PlatformAccount } from '@/lib/db';
import { TwitterClient, refreshTwitterToken } from '@/platforms/twitter/client';
import { getOAuthClientCredentials } from '@/lib/platform-credentials';
import {
  buildMessage,
  normalizeTwitterActions,
  type TweetItem,
  type TwitterActionConfig,
} from '@/lib/services/twitter-utils';

type ActionResult = {
  ok: boolean;
  error?: string;
  results: Record<string, any>;
  textUsed?: string;
};

function isTwitterUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  return lower.includes('401') || lower.includes('unauthorized');
}

export async function executeTwitterActions(params: {
  target: PlatformAccount;
  tweet: TweetItem;
  template?: string;
  accountInfo?: { username?: string; name?: string };
  actions?: TwitterActionConfig;
}): Promise<ActionResult> {
  const {
    target,
    tweet,
    template,
    accountInfo,
    actions,
  } = params;
  const normalized = normalizeTwitterActions(actions);
  let currentAccessToken = target.accessToken;
  let currentRefreshToken = target.refreshToken;
  let hasRefreshed = false;

  const runWithClientRetry = async <T>(operation: (client: TwitterClient) => Promise<T>): Promise<T> => {
    try {
      return await operation(new TwitterClient(currentAccessToken));
    } catch (error) {
      if (!currentRefreshToken || hasRefreshed || !isTwitterUnauthorizedError(error)) {
        throw error;
      }

      const oauthCreds = await getOAuthClientCredentials(target.userId, 'twitter');
      const refreshed = await refreshTwitterToken(currentRefreshToken, oauthCreds);
      currentAccessToken = refreshed.accessToken;
      currentRefreshToken = refreshed.refreshToken ?? currentRefreshToken;
      hasRefreshed = true;

      await db.updateAccount(target.id, {
        accessToken: currentAccessToken,
        refreshToken: currentRefreshToken,
      });

      return operation(new TwitterClient(currentAccessToken));
    }
  };

  const message = buildMessage(template, tweet, accountInfo).trim();
  const text = message || tweet.text || '';

  const needsText = Boolean(normalized.post || normalized.reply || normalized.quote);
  if (needsText && !text) {
    return { ok: false, error: 'Tweet text is empty', results: {} };
  }

  const results: Record<string, any> = {};
  const errors: string[] = [];

  if (normalized.post) {
    try {
      results.post = await runWithClientRetry(client => client.tweet({ text }));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to post tweet');
    }
  }

  if (normalized.reply) {
    try {
      results.reply = await runWithClientRetry(client => client.replyTweet(text, tweet.id));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to reply to tweet');
    }
  }

  if (normalized.quote) {
    try {
      results.quote = await runWithClientRetry(client => client.quoteTweet(text, tweet.id));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to quote tweet');
    }
  }

  if (normalized.retweet) {
    if (!target.accountId) {
      errors.push('Missing Twitter target account ID for retweet');
    } else {
      try {
        const ok = await runWithClientRetry(client => client.retweet(target.accountId, tweet.id));
        if (!ok) errors.push('Failed to retweet');
        results.retweet = ok;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Failed to retweet');
      }
    }
  }

  if (normalized.like) {
    if (!target.accountId) {
      errors.push('Missing Twitter target account ID for like');
    } else {
      try {
        const ok = await runWithClientRetry(client => client.likeTweet(target.accountId, tweet.id));
        if (!ok) errors.push('Failed to like tweet');
        results.like = ok;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Failed to like tweet');
      }
    }
  }

  return {
    ok: errors.length === 0,
    error: errors.length ? errors.join('; ') : undefined,
    results,
    textUsed: text,
  };
}
