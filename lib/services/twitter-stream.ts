export const runtime = 'nodejs';

import { db } from '@/lib/db';
import { TweetItem, buildMessage, buildTweetLink, isQuote, isReply, isRetweet, sendToTelegram } from '@/lib/services/twitter-utils';

const STREAM_URL = 'https://api.twitter.com/2/tweets/search/stream';

function getBearerToken() {
  return process.env.TWITTER_BEARER_TOKEN || '';
}

function buildRuleValue(username: string, filters: any) {
  let query = `from:${username}`;
  
  if (filters?.triggerType === 'on_mention') {
    query = `@${username}`;
  } else if (filters?.triggerType === 'on_keyword') {
    query = filters.triggerValue || '';
  } else if (filters?.triggerType === 'on_hashtag') {
    query = filters.triggerValue?.startsWith('#') ? filters.triggerValue : `#${filters.triggerValue}`;
  }

  const parts = [query];
  if (filters?.excludeReplies || filters?.originalOnly) parts.push('-is:reply');
  if (filters?.excludeRetweets || filters?.originalOnly) parts.push('-is:retweet');
  if (filters?.excludeQuotes || filters?.originalOnly) parts.push('-is:quote');
  return parts.join(' ');
}

function buildRules(tasks: any[]) {
  const rules: Array<{ value: string; tag: string }> = [];
  for (const task of tasks) {
    const filters = task.filters || {};
    if (filters.twitterSourceType === 'username') {
      const username = String(filters.twitterUsername || '').trim();
      if (!username) continue;
      rules.push({ value: buildRuleValue(username, filters), tag: `task:${task.id}` });
      continue;
    }
    for (const source of task.sourceAccountsResolved || []) {
      const username =
        source.accountUsername ||
        source.credentials?.accountInfo?.username ||
        '';
      if (!username) continue;
      rules.push({ value: buildRuleValue(username, filters), tag: `task:${task.id}` });
    }
  }
  return rules;
}

export class TwitterStream {
  private abortController: AbortController | null = null;
  private running = false;

  async start() {
    if (this.running) return;
    if (!process.env.TWITTER_STREAM_ENABLED || process.env.TWITTER_STREAM_ENABLED === 'false') {
      console.log('[TwitterStream] Stream is disabled via TWITTER_STREAM_ENABLED');
      return;
    }
    const bearerToken = getBearerToken();
    if (!bearerToken) {
      console.warn('[TwitterStream] Missing TWITTER_BEARER_TOKEN');
      return;
    }
    this.running = true;
    console.log('[TwitterStream] Starting stream connection...');
    await this.syncRules();
    this.connect().catch(err => {
      console.error('[TwitterStream] Connection error:', err);
      this.running = false;
    });
  }

  stop() {
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.running = false;
  }

  private async syncRules() {
    const tasks = await db.getAllTasks();
    const active = tasks.filter(t => t.status === 'active');
    const accounts = await db.getAllAccounts();
    const accountsById = new Map(accounts.map(a => [a.id, a]));
    const withSources = active.map(t => ({
      ...t,
      sourceAccountsResolved: t.sourceAccounts.map(id => accountsById.get(id)).filter(Boolean),
    }));

    const rules = buildRules(withSources);

    const existing = await this.fetchRules();
    if (existing.length > 0) {
      await this.deleteRules(existing.map(r => r.id));
    }
    if (rules.length > 0) {
      await this.addRules(rules);
    }
  }

  private async fetchRules(): Promise<Array<{ id: string; value: string; tag?: string }>> {
    const res = await fetch(`${STREAM_URL}/rules`, {
      headers: { Authorization: `Bearer ${getBearerToken()}` },
    });
    if (!res.ok) {
      console.warn('[TwitterStream] Failed to fetch rules:', res.statusText);
      return [];
    }
    const data = await res.json();
    return data.data || [];
  }

  private async deleteRules(ids: string[]) {
    const res = await fetch(`${STREAM_URL}/rules`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getBearerToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ delete: { ids } }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[TwitterStream] Failed to delete rules:', res.statusText, JSON.stringify(errorData));
    }
  }

  private async addRules(rules: Array<{ value: string; tag: string }>) {
    const res = await fetch(`${STREAM_URL}/rules`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getBearerToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ add: rules }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[TwitterStream] Failed to add rules:', res.statusText, JSON.stringify(errorData));
      if (res.status === 403) {
        console.error('[TwitterStream] 403 Forbidden - Check if your Bearer Token has the correct permissions (Essential vs Pro)');
      }
    }
  }

  private async connect() {
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,attachments,referenced_tweets,author_id',
      expansions: 'attachments.media_keys,author_id',
      'media.fields': 'type,url,preview_image_url',
      'user.fields': 'username,name',
    });

    this.abortController = new AbortController();
    const res = await fetch(`${STREAM_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${getBearerToken()}` },
      signal: this.abortController.signal,
    });

    if (!res.ok || !res.body) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[TwitterStream] Stream connection failed:', res.statusText, JSON.stringify(errorData));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          if (line.startsWith('{"errors"')) {
            console.error('[TwitterStream] Stream error response:', line);
            this.running = false;
            break;
          }
          const event = JSON.parse(line);
          await this.handleEvent(event);
        } catch (err) {
          console.warn('[TwitterStream] Failed to parse event:', err);
        }
      }
    }
  }

  public async handleEvent(event: any) {
    if (!event?.data?.id) return;

    const tweet = event.data;
    const includes = event.includes || {};
    const mediaByKey = new Map<string, { type: string; url?: string; previewImageUrl?: string }>();
    for (const m of includes.media || []) {
      mediaByKey.set(m.media_key, {
        type: m.type,
        url: m.url,
        previewImageUrl: m.preview_image_url,
      });
    }
    const author = (includes.users || [])[0] || {};
    const media =
      tweet.attachments?.media_keys?.map((key: string) => mediaByKey.get(key)).filter(Boolean) || [];

    const tweetItem: TweetItem = {
      id: tweet.id,
      text: tweet.text || '',
      createdAt: tweet.created_at || new Date().toISOString(),
      referencedTweets: tweet.referenced_tweets,
      media: media as any,
    };

    const matchingRules = event.matching_rules || [];
    for (const rule of matchingRules) {
      const tag = rule.tag || '';
      if (!tag.startsWith('task:')) continue;
      const taskId = tag.slice('task:'.length);
      const task = await db.getTask(taskId);
      if (!task || task.status !== 'active') continue;

      const filters = task.filters || {};
      if (filters.originalOnly && (isReply(tweetItem) || isRetweet(tweetItem) || isQuote(tweetItem))) continue;
      if (filters.excludeReplies && isReply(tweetItem)) continue;
      if (filters.excludeRetweets && isRetweet(tweetItem)) continue;
      if (filters.excludeQuotes && isQuote(tweetItem)) continue;

      const userAccounts = await db.getUserAccounts(task.userId);
      const targets = userAccounts.filter(a => task.targetAccounts.includes(a.id) && a.isActive && a.platformId === 'telegram');

      const message = buildMessage(task.transformations?.template, tweetItem, {
        username: author.username,
        name: author.name,
      });
      const includeMedia = task.transformations?.includeMedia !== false;
      const enableYtDlp = task.transformations?.enableYtDlp === true;
      const link = buildTweetLink(author.username || '', tweetItem.id);

      for (const target of targets) {
        let status: 'success' | 'failed' = 'success';
        let errorMessage: string | undefined;
        try {
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
        } catch (error) {
          status = 'failed';
          errorMessage = error instanceof Error ? error.message : 'Unknown error';
        }

        await db.createExecution({
          taskId: task.id,
          sourceAccount: task.sourceAccounts[0] || '',
          targetAccount: target.id,
          originalContent: tweetItem.text,
          transformedContent: message,
          status,
          error: errorMessage,
          executedAt: new Date(),
          responseData: { sourceTweetId: tweetItem.id, sourceUsername: author.username },
        });
      }
    }
  }
}

const globalKey = '__twitterStream__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new TwitterStream();
}

export const twitterStream: TwitterStream = g[globalKey];

export async function ensureTwitterStreamStarted() {
  await twitterStream.start();
}
