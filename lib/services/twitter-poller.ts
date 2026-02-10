export const runtime = 'nodejs';

import { db } from '@/lib/db';
import { TwitterClient, refreshTwitterToken } from '@/platforms/twitter/client';
import { taskProcessor } from '@/lib/services/task-processor';
import {
  TweetItem,
  buildMessage,
  buildTweetLink,
  isQuote,
  isReply,
  isRetweet,
  sendToTelegram,
} from '@/lib/services/twitter-utils';
import { buildTwitterQuery } from '@/lib/services/twitter-query';
import { executeTwitterActions } from '@/lib/services/twitter-actions';
import { debugLog, debugError } from '@/lib/debug';

const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const MIN_POLL_INTERVAL_SECONDS = 5;
const MAX_POLL_INTERVAL_SECONDS = 300;

function clampSeconds(value: number) {
  if (value < MIN_POLL_INTERVAL_SECONDS) return MIN_POLL_INTERVAL_SECONDS;
  if (value > MAX_POLL_INTERVAL_SECONDS) return MAX_POLL_INTERVAL_SECONDS;
  return value;
}

function resolveSourceUsername(source: any, filters: any) {
  if (filters?.twitterSourceType === 'username') {
    return String(filters.twitterUsername || '').trim();
  }
  return (
    source.accountUsername ||
    source.credentials?.accountInfo?.username ||
    ''
  );
}

async function getLastProcessedTweetId(taskId: string, sourceAccountId: string): Promise<string | undefined> {
  const executions = await db.getTaskExecutions(taskId, 50);
  const match = executions.find(
    e => e.sourceAccount === sourceAccountId && e.responseData && (e.responseData as any).sourceTweetId
  );
  return match ? String((match.responseData as any).sourceTweetId) : undefined;
}

async function getLastExecutionTime(taskId: string): Promise<Date | undefined> {
  const executions = await db.getTaskExecutions(taskId, 1);
  const latest = executions[0];
  return latest ? new Date(latest.executedAt) : undefined;
}

async function getLastProcessedTweetIdForUsername(taskId: string, username: string): Promise<string | undefined> {
  const executions = await db.getTaskExecutions(taskId, 50);
  const match = executions.find(
    e =>
      e.responseData &&
      (e.responseData as any).sourceTweetId &&
      (e.responseData as any).sourceUsername === username
  );
  return match ? String((match.responseData as any).sourceTweetId) : undefined;
}

// sendToTelegram is now in twitter-utils

export class TwitterPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (this.intervalId) return;
    const scheduleNext = async () => {
      try {
        await this.tick();
      } catch (err) {
        console.error('[TwitterPoller] Tick failed:', err);
      } finally {
        const nextMs = await this.computeNextIntervalMs();
        this.intervalId = setTimeout(scheduleNext, nextMs);
      }
    };
    scheduleNext().catch(err => console.error('[TwitterPoller] Start failed:', err));
    console.log('[TwitterPoller] Started (dynamic interval)');
  }

  async runOnce() {
    await this.tick();
  }

  stop() {
    if (this.intervalId) clearTimeout(this.intervalId);
    this.intervalId = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const tasks = await db.getAllTasks();
      const activeTwitterTasks = tasks.filter(
        t => t.status === 'active' && t.sourceAccounts.length > 0 && t.targetAccounts.length > 0
      );
      debugLog('Twitter poller tick', { tasks: activeTwitterTasks.length });

      for (const task of activeTwitterTasks) {
        const sourceAccounts = (await Promise.all(task.sourceAccounts.map(id => db.getAccount(id))))
          .filter(Boolean) as any[];
        const targetAccounts = (await Promise.all(task.targetAccounts.map(id => db.getAccount(id))))
          .filter(Boolean) as any[];

        const twitterSources = sourceAccounts.filter(a => a.platformId === 'twitter' && a.isActive);
        const activeTargets = targetAccounts.filter(a => a.isActive);
        if (twitterSources.length === 0 || activeTargets.length === 0) continue;

        const filters = task.filters || {};
        const sourceType = filters.twitterSourceType || 'account';
        const triggerType = filters.triggerType || 'on_tweet';
        if (triggerType === 'on_like' && sourceType === 'username') {
          continue;
        }
        const pollIntervalSeconds = Number(filters.pollIntervalSeconds || 0);
        const pollIntervalMinutes = Number(filters.pollIntervalMinutes || 0);
        const intervalMs =
          pollIntervalSeconds > 0
            ? pollIntervalSeconds * 1000
            : pollIntervalMinutes > 0
              ? pollIntervalMinutes * 60 * 1000
              : 0;
        if (intervalMs > 0) {
          const lastExec = await getLastExecutionTime(task.id);
          if (lastExec) {
            const elapsedMs = Date.now() - lastExec.getTime();
            if (elapsedMs < intervalMs) {
              continue;
            }
          }
        }

        const sourcesToUse =
          sourceType === 'username' ? twitterSources.slice(0, 1) : twitterSources;

        for (const source of sourcesToUse) {
          if (
            sourceType === 'account' &&
            process.env.TWITTER_WEBHOOK_ENABLED === 'true' &&
            triggerType !== 'on_like'
          ) {
            continue;
          }
          const sinceId =
            sourceType === 'username'
              ? await getLastProcessedTweetIdForUsername(task.id, String(filters.twitterUsername || '').toLowerCase())
              : await getLastProcessedTweetId(task.id, source.id);

          const fetchTweets = async (accessToken: string) => {
            const client = new TwitterClient(accessToken);
            if (triggerType === 'on_like') {
              if (!source.accountId) throw new Error('Missing Twitter source account ID for likes');
              return client.getLikedTweets(source.accountId, 10, sinceId);
            }

            const username = resolveSourceUsername(source, filters);
            const query = buildTwitterQuery(username, filters);

            if (triggerType !== 'on_tweet') {
              if (!query) return [];
              return client.searchRecent(query, 10, sinceId);
            }

            if (sourceType === 'username' && filters.twitterUsername) {
              // Using searchRecentByUsername which is supported on Pay-as-you-go
              return client.searchRecentByUsername(filters.twitterUsername, 10, sinceId);
            }
            // User Tweets lookup is also supported on Pay-as-you-go
            return client.getTweetsWithMedia(source.accountId, 10, sinceId);
          };

          let tweets: TweetItem[];
          try {
            tweets = await fetchTweets(source.accessToken);
            debugLog('Twitter poller fetched tweets', { taskId: task.id, count: tweets.length });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isUnauthorized = message.includes('401') || message.toLowerCase().includes('unauthorized');
            if (isUnauthorized && source.refreshToken) {
              const refreshed = await refreshTwitterToken(source.refreshToken);
              await db.updateAccount(source.id, {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken ?? source.refreshToken,
              });
              source.accessToken = refreshed.accessToken;
              if (refreshed.refreshToken) source.refreshToken = refreshed.refreshToken;
              tweets = await fetchTweets(source.accessToken);
            } else {
              debugError('Twitter poller fetch failed', error, { taskId: task.id });
              throw error;
            }
          }

          const sorted = [...tweets].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

          const effectiveOriginalOnly = triggerType === 'on_retweet' ? false : Boolean(filters.originalOnly);
          const effectiveExcludeReplies = Boolean(filters.excludeReplies);
          const effectiveExcludeRetweets = triggerType === 'on_retweet' ? false : Boolean(filters.excludeRetweets);
          const effectiveExcludeQuotes = Boolean(filters.excludeQuotes);

          for (const tweet of sorted) {
            if (effectiveOriginalOnly) {
              if (isReply(tweet) || isRetweet(tweet) || isQuote(tweet)) continue;
            }
            if (effectiveExcludeReplies && isReply(tweet)) continue;
            if (effectiveExcludeRetweets && isRetweet(tweet)) continue;
            if (effectiveExcludeQuotes && isQuote(tweet)) continue;
            if (!taskProcessor.applyFilters(tweet.text, task.filters)) continue;

            const message = buildMessage(task.transformations?.template, tweet, source.credentials?.accountInfo);
            const includeMedia = task.transformations?.includeMedia !== false;
            const enableYtDlp = task.transformations?.enableYtDlp === true;
            const link = buildTweetLink(
              tweet.author?.username || source.credentials?.accountInfo?.username || '',
              tweet.id
            );

            for (const target of activeTargets) {
              let status: 'success' | 'failed' = 'success';
              let errorMessage: string | undefined;
              let responseData: Record<string, any> = {
                sourceTweetId: tweet.id,
                sourceUsername:
                  sourceType === 'username'
                    ? String(filters.twitterUsername || '').toLowerCase()
                    : source.credentials?.accountInfo?.username,
              };

              try {
                if (target.platformId === 'telegram') {
                  debugLog('Twitter poller -> Telegram start', { taskId: task.id, targetId: target.id });
                  const chatId = target.credentials?.chatId;
                  if (!chatId) throw new Error('Missing Telegram target chat ID');
                  await sendToTelegram(
                    target.accessToken,
                    String(chatId),
                    message,
                    tweet.media,
                    includeMedia,
                    link,
                    enableYtDlp
                  );
                  debugLog('Twitter poller -> Telegram sent', { taskId: task.id, targetId: target.id });
                } else if (target.platformId === 'twitter') {
                  debugLog('Twitter poller -> Twitter actions start', { taskId: task.id, targetId: target.id });
                  const actionResult = await executeTwitterActions({
                    target,
                    tweet,
                    template: task.transformations?.template,
                    accountInfo: source.credentials?.accountInfo,
                    actions: task.transformations?.twitterActions,
                  });
                  responseData = { ...responseData, actions: actionResult.results, textUsed: actionResult.textUsed };
                  if (!actionResult.ok) {
                    throw new Error(actionResult.error || 'Twitter actions failed');
                  }
                  debugLog('Twitter poller -> Twitter actions success', { taskId: task.id, targetId: target.id });
                } else {
                  continue;
                }
              } catch (error) {
                status = 'failed';
                errorMessage = error instanceof Error ? error.message : 'Unknown error';
                debugError('Twitter poller target failed', error, { taskId: task.id, targetId: target.id });
              }

              await db.createExecution({
                taskId: task.id,
                sourceAccount: source.id,
                targetAccount: target.id,
                originalContent: tweet.text,
                transformedContent: message,
                status,
                error: errorMessage,
                executedAt: new Date(),
                responseData,
              });
            }
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async computeNextIntervalMs(): Promise<number> {
    try {
      const tasks = await db.getAllTasks();
      const active = tasks.filter(t => t.status === 'active');
      if (active.length === 0) return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
      const values = active
        .map(t => Number(t.filters?.pollIntervalSeconds || 0))
        .filter(v => Number.isFinite(v) && v > 0);
      const min = values.length > 0 ? Math.min(...values) : DEFAULT_POLL_INTERVAL_SECONDS;
      return clampSeconds(min) * 1000;
    } catch (error) {
      console.error('[TwitterPoller] Failed to compute interval:', error);
      return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
    }
  }
}

const globalKey = '__twitterPoller__';
const g = globalThis as any;
if (!g[globalKey]) {
  g[globalKey] = new TwitterPoller();
}

export const twitterPoller: TwitterPoller = g[globalKey];

function taskNeedsPolling(task: any, accountsById: Map<string, any>) {
  if (task.status !== 'active') return false;
  if (!Array.isArray(task.sourceAccounts) || task.sourceAccounts.length === 0) return false;
  if (!Array.isArray(task.targetAccounts) || task.targetAccounts.length === 0) return false;

  const filters = task.filters || {};
  const triggerType = filters.triggerType || 'on_tweet';
  const sourceType = filters.twitterSourceType || 'account';
  const hasTwitterSource = task.sourceAccounts
    .map((id: string) => accountsById.get(id))
    .some((a: any) => a?.platformId === 'twitter' && a?.isActive);
  if (!hasTwitterSource) return false;

  if (process.env.TWITTER_WEBHOOK_ENABLED === 'true') {
    if (triggerType === 'on_like') return true;
    if (sourceType === 'username') return true;
    if (triggerType === 'on_search' || triggerType === 'on_keyword' || triggerType === 'on_hashtag') return true;
    if (triggerType === 'on_mention' || triggerType === 'on_retweet') return true;
    return false;
  }
  return true;
}

export async function ensureTwitterPollingStarted() {
  if (process.env.TWITTER_POLLING_ENABLED === 'false') {
    twitterPoller.stop();
    return;
  }
  try {
    const tasks = await db.getAllTasks();
    const accounts = await db.getAllAccounts();
    const accountsById = new Map(accounts.map(a => [a.id, a]));
    const shouldStart = tasks.some(t => taskNeedsPolling(t, accountsById));
    if (shouldStart) {
      twitterPoller.start();
    } else {
      twitterPoller.stop();
    }
  } catch (error) {
    console.error('[TwitterPoller] Failed to decide start/stop:', error);
    twitterPoller.start();
  }
}
