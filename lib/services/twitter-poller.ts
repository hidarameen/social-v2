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

const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const MIN_POLL_INTERVAL_SECONDS = 5;
const MAX_POLL_INTERVAL_SECONDS = 300;

function clampSeconds(value: number) {
  if (value < MIN_POLL_INTERVAL_SECONDS) return MIN_POLL_INTERVAL_SECONDS;
  if (value > MAX_POLL_INTERVAL_SECONDS) return MAX_POLL_INTERVAL_SECONDS;
  return value;
}

function buildQueryExtras(filters?: any) {
  if (!filters) return '';
  const extras: string[] = [];
  if (filters.excludeReplies || filters.originalOnly) extras.push('-is:reply');
  if (filters.excludeRetweets || filters.originalOnly) extras.push('-is:retweet');
  if (filters.excludeQuotes || filters.originalOnly) extras.push('-is:quote');
  return extras.join(' ');
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

      for (const task of activeTwitterTasks) {
        const sourceAccounts = (await Promise.all(task.sourceAccounts.map(id => db.getAccount(id))))
          .filter(Boolean) as any[];
        const targetAccounts = (await Promise.all(task.targetAccounts.map(id => db.getAccount(id))))
          .filter(Boolean) as any[];

        const twitterSources = sourceAccounts.filter(a => a.platformId === 'twitter' && a.isActive);
        const telegramTargets = targetAccounts.filter(a => a.platformId === 'telegram' && a.isActive);
        if (twitterSources.length === 0 || telegramTargets.length === 0) continue;

        const filters = task.filters || {};
        const sourceType = filters.twitterSourceType || 'account';
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
          if (sourceType === 'account' && process.env.TWITTER_WEBHOOK_ENABLED === 'true') {
            continue;
          }
          const queryExtras = buildQueryExtras(filters);
          const sinceId =
            sourceType === 'username'
              ? await getLastProcessedTweetIdForUsername(task.id, String(filters.twitterUsername || '').toLowerCase())
              : await getLastProcessedTweetId(task.id, source.id);

          const fetchTweets = async (accessToken: string) => {
            const client = new TwitterClient(accessToken);
            if (sourceType === 'username' && filters.twitterUsername) {
              // Using searchRecentByUsername which is supported on Pay-as-you-go
              return client.searchRecentByUsername(filters.twitterUsername, 10, sinceId, queryExtras);
            }
            // User Tweets lookup is also supported on Pay-as-you-go
            return client.getTweetsWithMedia(source.accountId, 10, sinceId);
          };

          let tweets: TweetItem[];
          try {
            tweets = await fetchTweets(source.accessToken);
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
              throw error;
            }
          }

          const sorted = [...tweets].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

          for (const tweet of sorted) {
            if (filters.originalOnly) {
              if (isReply(tweet) || isRetweet(tweet) || isQuote(tweet)) continue;
            }
            if (filters.excludeReplies && isReply(tweet)) continue;
            if (filters.excludeRetweets && isRetweet(tweet)) continue;
            if (filters.excludeQuotes && isQuote(tweet)) continue;
            if (!taskProcessor.applyFilters(tweet.text, task.filters)) continue;

            const message = buildMessage(task.transformations?.template, tweet, source.credentials?.accountInfo);
            const includeMedia = task.transformations?.includeMedia !== false;
            const enableYtDlp = task.transformations?.enableYtDlp === true;
            const link = buildTweetLink(
              source.credentials?.accountInfo?.username || '',
              tweet.id
            );

            for (const target of telegramTargets) {
              let status: 'success' | 'failed' = 'success';
              let errorMessage: string | undefined;

              try {
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
              } catch (error) {
                status = 'failed';
                errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
                responseData: {
                  sourceTweetId: tweet.id,
                  sourceUsername:
                    sourceType === 'username'
                      ? String(filters.twitterUsername || '').toLowerCase()
                      : source.credentials?.accountInfo?.username,
                },
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

export function ensureTwitterPollingStarted() {
  twitterPoller.start();
}
