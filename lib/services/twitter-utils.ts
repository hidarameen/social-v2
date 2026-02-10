import { TelegramClient } from '@/platforms/telegram/client';
import { downloadTweetVideo } from '@/lib/services/ytdlp';

export type TweetItem = {
  id: string;
  text: string;
  createdAt: string;
  referencedTweets?: Array<{ id: string; type: string }>;
  media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
  author?: { username?: string; name?: string };
};

export type TwitterActionConfig = {
  post?: boolean;
  reply?: boolean;
  quote?: boolean;
  retweet?: boolean;
  like?: boolean;
};

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toISOString();
  } catch {
    return iso;
  }
}

export function buildMessage(
  taskTemplate: string | undefined,
  tweet: TweetItem,
  accountInfo?: { username?: string; name?: string }
) {
  const username = tweet.author?.username || accountInfo?.username || '';
  const name = tweet.author?.name || accountInfo?.name || '';
  const link = buildTweetLink(username, tweet.id);
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

  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const token = `%${key}%`;
    result = result.split(token).join(value);
  }
  return result.trim();
}

export function buildTweetLink(username: string, tweetId: string) {
  return username
    ? `https://twitter.com/${username}/status/${tweetId}`
    : `https://twitter.com/i/web/status/${tweetId}`;
}

export function clampTweetText(text: string) {
  if (text.length <= 280) return text;
  return `${text.slice(0, 277)}...`;
}

export function normalizeTwitterActions(input?: TwitterActionConfig) {
  const actions: TwitterActionConfig = {
    post: Boolean(input?.post),
    reply: Boolean(input?.reply),
    quote: Boolean(input?.quote),
    retweet: Boolean(input?.retweet),
    like: Boolean(input?.like),
  };

  const hasAny = Object.values(actions).some(Boolean);
  if (!hasAny) {
    return { post: true };
  }
  return actions;
}

export function isReply(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'replied_to'));
}

export function isRetweet(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'retweeted'));
}

export function isQuote(tweet: TweetItem): boolean {
  return Boolean(tweet.referencedTweets?.some(t => t.type === 'quoted'));
}

export async function sendToTelegram(
  telegramAccountToken: string,
  chatId: string,
  message: string,
  media: TweetItem['media'],
  includeMedia: boolean,
  tweetLink?: string,
  enableYtDlp?: boolean
) {
  const client = new TelegramClient(telegramAccountToken);

  if (!includeMedia || media.length === 0) {
    await client.sendMessage(chatId, message);
    return;
  }

  const photos = media.filter(m => m.type === 'photo' && m.url).map(m => m.url as string);
  const videos = media.filter(m => m.type === 'video' || m.type === 'animated_gif');

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
    if (tweetLink && enableYtDlp) {
      try {
        const { videoPath, thumbnailPath, duration } = await downloadTweetVideo(tweetLink);
        await client.sendVideoFile(chatId, videoPath, message, duration, thumbnailPath);
        return;
      } catch (error) {
        console.warn('[TwitterUtils] Video download failed, falling back:', error);
      }
    }
    const first = videos[0];
    const url = first?.previewImageUrl || first?.url || '';
    if (url) {
      await client.sendPhoto(chatId, url, message);
      return;
    }
  }

  await client.sendMessage(chatId, message);
}
