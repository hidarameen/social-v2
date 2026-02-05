import { db } from '@/lib/db';
import { TwitterClient } from '@/platforms/twitter/client';
import { TelegramClient } from '@/platforms/telegram/client';
import { taskProcessor } from '@/lib/services/task-processor';

type TweetItem = {
  id: string;
  text: string;
  createdAt: string;
  referencedTweets?: Array<{ id: string; type: string }>;
  media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
};

const DEFAULT_POLL_INTERVAL_SECONDS = 120;

function getPollIntervalMs() {
  const raw = process.env.TWITTER_POLL_INTERVAL_SECONDS;
  const seconds = raw ? Number(raw) : DEFAULT_POLL_INTERVAL_SECONDS;
  if (!Number.isFinite(seconds) || seconds < 15) return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
  return Math.floor(seconds * 1000);
}

function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const token = `%${key}%`;
    result = result.split(token).join(value);
  }
  return result;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

function buildMessage(taskTemplate: string | undefined, tweet: TweetItem, accountInfo?: { username?: string; name?: string }) {
  const username = accountInfo?.username || '';
  const name = accountInfo?.name || '';
  const link = username ? `https://twitter.com/${username}/status/${tweet.id}` : `https://twitter.com/i/web/status/${tweet.id}`;
  const mediaUrls = tweet.media
    .map(m => m.url || m.previewImageUrl)
    .filter(Boolean)
    .join('\n');

  const data = {
    text: tweet.text || '',
    username,
    name,
    date: formatDate(tweet.createdAt),
    link,
    media: mediaUrls,
  };

  const template =
    taskTemplate?.trim() ||
    `%name% (@%username%)\n%date%\n%text%\n%link%`;

  return renderTemplate(template, data).trim();
}

function isReply(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'replied_to'));
}

function isRetweet(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'retweeted'));
}

function isQuote(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'quoted'));
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

async function sendToTelegram(
  telegramAccountToken: string,
  chatId: string,
  message: string,
  media: TweetItem['media'],
  includeMedia: boolean
) {
  const client = new TelegramClient(telegramAccountToken);

  if (!includeMedia || media.length === 0) {
    await client.sendMessage(chatId, message);
    return;
  }

  const photos = media.filter(m => m.type === 'photo' && m.url).map(m => m.url as string);
  const videos = media.filter(m => m.type === 'video' && (m.url || m.previewImageUrl));

  if (photos.length > 0) {
    const group = photos.map((url, idx) => ({
      type: 'photo' as const,
      media: url,
      caption: idx === 0 ? message : undefined,
    }));
    await client.sendMediaGroup(chatId, group);
    return;
  }

  if (videos.length > 0) {
    const first = videos[0];
    const url = first.url || first.previewImageUrl || '';
    if (url) {
      await client.sendVideo(chatId, url, message);
      return;
    }
  }

  await client.sendMessage(chatId, message);
}

export class TwitterPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  start() {
    if (this.intervalId) return;
    const interval = getPollIntervalMs();
    this.intervalId = setInterval(() => {
      this.tick().catch(err => console.error('[TwitterPoller] Tick failed:', err));
    }, interval);
    console.log(`[TwitterPoller] Started with interval ${interval}ms`);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
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

        const sourcesToUse =
          sourceType === 'username' ? twitterSources.slice(0, 1) : twitterSources;

        for (const source of sourcesToUse) {
          if (sourceType === 'account' && process.env.TWITTER_WEBHOOK_ENABLED === 'true') {
            continue;
          }
          const client = new TwitterClient(source.accessToken);
          const queryExtras = buildQueryExtras(filters);
          const sinceId =
            sourceType === 'username'
              ? await getLastProcessedTweetIdForUsername(task.id, String(filters.twitterUsername || '').toLowerCase())
              : await getLastProcessedTweetId(task.id, source.id);

          const tweets =
            sourceType === 'username' && filters.twitterUsername
              ? await client.searchRecentByUsername(filters.twitterUsername, 10, sinceId, queryExtras)
              : await client.getTweetsWithMedia(source.accountId, 10, sinceId);

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

            for (const target of telegramTargets) {
              let status: 'success' | 'failed' = 'success';
              let errorMessage: string | undefined;

              try {
                const chatId = target.credentials?.chatId;
                if (!chatId) throw new Error('Missing Telegram target chat ID');
                await sendToTelegram(target.accessToken, String(chatId), message, tweet.media, includeMedia);
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
