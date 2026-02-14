export const runtime = 'nodejs';

import { db } from '@/lib/db';
import { TweetItem, buildMessage, buildTweetLink, isQuote, isReply, isRetweet, prepareYouTubeVideoFromTweet, sendToTelegram } from '@/lib/services/twitter-utils';
import { buildTwitterQuery } from '@/lib/services/twitter-query';
import { executeTwitterActions } from '@/lib/services/twitter-actions';
import { executeYouTubePublish } from '@/lib/services/youtube-actions';
import { publishToFacebook } from '@/lib/services/facebook-publish';
import { executionQueue } from '@/lib/services/execution-queue';
import { debugLog, debugError } from '@/lib/debug';
import { getAnyTwitterBearerToken } from '@/lib/platform-credentials';

const STREAM_URL = 'https://api.twitter.com/2/tweets/search/stream';

function buildRules(tasks: any[]) {
  const rules: Array<{ value: string; tag: string }> = [];
  for (const task of tasks) {
    const filters = task.filters || {};
    if (filters.twitterSourceType === 'username') {
      const username = String(filters.twitterUsername || '').trim();
      if (!username) continue;
      const value = buildTwitterQuery(username, filters);
      if (value) rules.push({ value, tag: `task:${task.id}` });
      continue;
    }
    for (const source of task.sourceAccountsResolved || []) {
      const username =
        source.accountUsername ||
        source.credentials?.accountInfo?.username ||
        '';
      if (!username) continue;
      const value = buildTwitterQuery(username, filters);
      if (value) rules.push({ value, tag: `task:${task.id}` });
    }
  }
  return rules;
}

export class TwitterStream {
  private abortController: AbortController | null = null;
  private running = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelayMs = 0;
  private nextConnectAllowedAt = 0;
  private bearerToken = '';

  private async refreshBearerToken() {
    this.bearerToken = (await getAnyTwitterBearerToken()) || '';
  }

  async start() {
    if (this.running || this.connecting) return;
    if (!process.env.TWITTER_STREAM_ENABLED || process.env.TWITTER_STREAM_ENABLED === 'false') {
      console.log('[TwitterStream] Stream is disabled via TWITTER_STREAM_ENABLED');
      return;
    }

    const now = Date.now();
    if (this.nextConnectAllowedAt > now) {
      const waitMs = this.nextConnectAllowedAt - now;
      console.warn('[TwitterStream] Connect delayed by backoff', { waitMs });
      this.scheduleReconnect(waitMs);
      return;
    }

    await this.refreshBearerToken();
    if (!this.bearerToken) {
      console.warn('[TwitterStream] Missing Twitter bearer token in DB credentials');
      return;
    }
    this.running = true;
    console.log('[TwitterStream] Starting stream connection...');
    await this.syncRules();
    debugLog('Twitter stream started');
    this.connecting = true;
    this.connect().catch(err => {
      console.error('[TwitterStream] Connection error:', err);
      this.running = false;
      this.connecting = false;
      this.scheduleReconnect();
    });
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.abortController) this.abortController.abort();
    this.abortController = null;
    this.running = false;
    this.connecting = false;
  }

  private scheduleReconnect(delayMs?: number) {
    if (!process.env.TWITTER_STREAM_ENABLED || process.env.TWITTER_STREAM_ENABLED === 'false') return;
    if (this.reconnectTimer) return;

    const base = typeof delayMs === 'number' ? delayMs : this.nextRetryDelayMs();
    const jitter = Math.floor(Math.random() * 1500);
    const waitMs = Math.max(5_000, base + jitter);
    this.nextConnectAllowedAt = Date.now() + waitMs;

    console.warn('[TwitterStream] Scheduling reconnect', { waitMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, waitMs);
  }

  private nextRetryDelayMs(): number {
    // Exponential backoff up to 15 minutes.
    const next = this.retryDelayMs > 0 ? Math.min(this.retryDelayMs * 2, 15 * 60_000) : 15_000;
    this.retryDelayMs = next;
    return next;
  }

  private setRateLimitBackoff(minMs: number) {
    // For 429 / connection limit, use a larger minimum delay.
    const next = Math.max(minMs, this.retryDelayMs || 0);
    this.retryDelayMs = Math.min(next, 30 * 60_000);
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
    debugLog('Twitter stream sync rules', { rules: rules.length });

    const existing = await this.fetchRules();
    if (existing.length > 0) {
      await this.deleteRules(existing.map(r => r.id));
    }
    if (rules.length > 0) {
      await this.addRules(rules);
    }
  }

  private async fetchRules(): Promise<Array<{ id: string; value: string; tag?: string }>> {
    if (!this.bearerToken) return [];
    const res = await fetch(`${STREAM_URL}/rules`, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
    });
    if (!res.ok) {
      console.warn('[TwitterStream] Failed to fetch rules:', res.statusText);
      return [];
    }
    const data = await res.json();
    return data.data || [];
  }

  private async deleteRules(ids: string[]) {
    if (!this.bearerToken) return;
    const res = await fetch(`${STREAM_URL}/rules`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
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
    if (!this.bearerToken) return;
    const res = await fetch(`${STREAM_URL}/rules`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
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
      headers: { Authorization: `Bearer ${this.bearerToken}` },
      signal: this.abortController.signal,
    });

    if (!res.ok || !res.body) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[TwitterStream] Stream connection failed:', res.statusText, JSON.stringify(errorData));
      this.connecting = false;
      this.running = false;

      const connectionIssue = String((errorData as any)?.connection_issue || '');
      if (res.status === 429 || connectionIssue.includes('TooMany')) {
        // Twitter will keep rejecting new connections; don't hammer it.
        this.setRateLimitBackoff(5 * 60_000);
      }
      this.scheduleReconnect();
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
          debugLog('Twitter stream event received');
          await this.handleEvent(event);
        } catch (err) {
          console.warn('[TwitterStream] Failed to parse event:', err);
        }
      }
      if (!this.running) break;
    }

    // Connection ended; try again with backoff.
    this.connecting = false;
    this.running = false;
    this.scheduleReconnect();
  }

  private async processMatchedTask(
    taskId: string,
    tweetItem: TweetItem,
    author: { username?: string; name?: string }
  ) {
    const task = await db.getTask(taskId);
    if (!task || task.status !== 'active') return;
    debugLog('Twitter stream task matched', { taskId });

    const filters = task.filters || {};
    const triggerType = filters.triggerType || 'on_tweet';
    const effectiveOriginalOnly = triggerType === 'on_retweet' ? false : Boolean(filters.originalOnly);
    const effectiveExcludeReplies = Boolean(filters.excludeReplies);
    const effectiveExcludeRetweets = triggerType === 'on_retweet' ? false : Boolean(filters.excludeRetweets);
    const effectiveExcludeQuotes = Boolean(filters.excludeQuotes);

    if (effectiveOriginalOnly && (isReply(tweetItem) || isRetweet(tweetItem) || isQuote(tweetItem))) return;
    if (effectiveExcludeReplies && isReply(tweetItem)) return;
    if (effectiveExcludeRetweets && isRetweet(tweetItem)) return;
    if (effectiveExcludeQuotes && isQuote(tweetItem)) return;

    const userAccounts = await db.getUserAccounts(task.userId);
    const targets = userAccounts.filter(a => task.targetAccounts.includes(a.id) && a.isActive);

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
      let responseData: Record<string, any> = { sourceTweetId: tweetItem.id, sourceUsername: author.username };

      try {
        if (target.platformId === 'telegram') {
          debugLog('Twitter -> Telegram start', { taskId: task.id, targetId: target.id });
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
          debugLog('Twitter -> Telegram sent', { taskId: task.id, targetId: target.id });
        } else if (target.platformId === 'twitter') {
          debugLog('Twitter -> Twitter actions start', { taskId: task.id, targetId: target.id });
          const actionResult = await executeTwitterActions({
            target,
            tweet: tweetItem,
            template: task.transformations?.template,
            accountInfo: { username: author.username, name: author.name },
            actions: task.transformations?.twitterActions,
          });
          responseData = { ...responseData, actions: actionResult.results, textUsed: actionResult.textUsed };
          if (!actionResult.ok) {
            throw new Error(actionResult.error || 'Twitter actions failed');
          }
          debugLog('Twitter -> Twitter actions success', { taskId: task.id, targetId: target.id });
        } else if (target.platformId === 'youtube') {
          debugLog('Twitter -> YouTube start', { taskId: task.id, targetId: target.id });
          const mediaCandidates = includeMedia ? tweetItem.media : [];
          const hasVideoMedia = mediaCandidates.some(
            (item) => item.type === 'video' || item.type === 'animated_gif'
          );

          if (hasVideoMedia) {
            const media = await prepareYouTubeVideoFromTweet(tweetItem, link, enableYtDlp);
            try {
              const result = await executeYouTubePublish({
                target,
                filePath: media.tempPath,
                mimeType: media.mimeType,
                transformations: task.transformations,
                context: {
                  taskId: task.id,
                  text: message,
                  username: author.username || '',
                  name: author.name || '',
                  date: tweetItem.createdAt,
                  link,
                },
              });
              responseData = {
                ...responseData,
                youtube: result,
                mediaSource: media.viaYtDlp ? 'yt-dlp' : 'direct_url',
                publishMode: 'video_upload',
              };
            } finally {
              await media.cleanup().catch(() => undefined);
            }
            debugLog('Twitter -> YouTube upload success', {
              taskId: task.id,
              targetId: target.id,
              videoId: responseData?.youtube?.id,
            });
          } else {
            throw new Error(
              'YouTube targets accept video uploads only. Skipping non-video content.'
            );
          }
        } else if (target.platformId === 'facebook') {
          debugLog('Twitter -> Facebook start', { taskId: task.id, targetId: target.id });
          const mediaCandidates = includeMedia ? tweetItem.media : [];
          const videoUrl = mediaCandidates.find(
            (item) => (item.type === 'video' || item.type === 'animated_gif') && item.url
          )?.url;
          const photoUrl = mediaCandidates.find(
            (item) => item.type === 'photo' && item.url
          )?.url;

          const facebookResult = await publishToFacebook({
            target,
            message,
            link,
            media: videoUrl
              ? { kind: 'video', url: videoUrl }
              : photoUrl
                ? { kind: 'image', url: photoUrl }
                : undefined,
          });
          responseData = {
            ...responseData,
            facebook: facebookResult,
          };
          debugLog('Twitter -> Facebook publish success', {
            taskId: task.id,
            targetId: target.id,
            postId: facebookResult.id,
          });
        } else {
          continue;
        }
      } catch (error) {
        status = 'failed';
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        debugError('Twitter stream target failed', error, { taskId: task.id, targetId: target.id });
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
        responseData,
      });
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
      author: { username: author.username, name: author.name },
    };
    debugLog('Twitter stream tweet parsed', { tweetId: tweetItem.id });

    const matchingRules = event.matching_rules || [];
    for (const rule of matchingRules) {
      const tag = rule.tag || '';
      if (!tag.startsWith('task:')) continue;
      const taskId = tag.slice('task:'.length);
      void executionQueue
        .enqueue({
          label: 'twitter:stream-event',
          taskId,
          dedupeKey: `twitter:stream:${taskId}:${tweetItem.id}`,
          run: async () => {
            await this.processMatchedTask(taskId, tweetItem, {
              username: author.username,
              name: author.name,
            });
          },
        })
        .catch((error) => {
          debugError('Twitter stream queued processing failed', error, { taskId, tweetId: tweetItem.id });
        });
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
