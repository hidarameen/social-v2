import { TwitterContent, TwitterTweet } from './types'
import { promises as fs } from 'fs'
import { debugError, debugLog } from '@/lib/debug'
import crypto from 'crypto'

const TWITTER_API_V2 = 'https://api.twitter.com/2'
const TWITTER_MEDIA_V2 = 'https://api.x.com/2/media/upload'

export class TwitterClient {
  private bearerToken: string

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken
  }

  private getOAuth1Credentials() {
    const consumerKey =
      process.env.TWITTER_CONSUMER_KEY ||
      process.env.TWITTER_API_KEY ||
      process.env.TWITTER_CLIENT_ID;
    const consumerSecret =
      process.env.TWITTER_CONSUMER_SECRET ||
      process.env.TWITTER_API_SECRET ||
      process.env.TWITTER_CLIENT_SECRET;
    const token =
      process.env.TWITTER_ACCESS_TOKEN ||
      process.env.TWITTER_USER_ACCESS_TOKEN ||
      process.env.TWITTER_OAUTH_TOKEN;
    const tokenSecret =
      process.env.TWITTER_ACCESS_TOKEN_SECRET ||
      process.env.TWITTER_USER_ACCESS_TOKEN_SECRET ||
      process.env.TWITTER_OAUTH_TOKEN_SECRET;

    if (!consumerKey || !consumerSecret || !token || !tokenSecret) {
      debugError('Twitter OAuth1 credentials missing', null, {
        hasConsumerKey: Boolean(consumerKey),
        hasConsumerSecret: Boolean(consumerSecret),
        hasToken: Boolean(token),
        hasTokenSecret: Boolean(tokenSecret),
      });
      return null;
    }
    return { consumerKey, consumerSecret, token, tokenSecret };
  }

  private percentEncode(value: string) {
    return encodeURIComponent(value)
      .replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  private buildOAuth1Header(method: string, url: string, params: Record<string, string>) {
    const creds = this.getOAuth1Credentials();
    if (!creds) return null;

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: creds.consumerKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: creds.token,
      oauth_version: '1.0',
    };

    const allParams: Record<string, string> = { ...params, ...oauthParams };
    const normalized = Object.keys(allParams)
      .sort()
      .map(k => `${this.percentEncode(k)}=${this.percentEncode(allParams[k])}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(normalized),
    ].join('&');

    const signingKey = `${this.percentEncode(creds.consumerSecret)}&${this.percentEncode(creds.tokenSecret)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    const oauthHeaderParams = {
      ...oauthParams,
      oauth_signature: signature,
    };

    const header = 'OAuth ' + Object.keys(oauthHeaderParams)
      .sort()
      .map(k => `${this.percentEncode(k)}=\"${this.percentEncode(oauthHeaderParams[k])}\"`)
      .join(', ');

    debugLog('Twitter OAuth1 header built', { method, url });
    return header;
  }

  private getUploadHeaders(method: string, url: string, params: Record<string, string>) {
    const oauth1 = this.buildOAuth1Header(method, url, params);
    if (oauth1) {
      return { Authorization: oauth1 };
    }
    debugError('Twitter OAuth1 not used, falling back to OAuth2', null, {
      url,
      method,
    });
    return { Authorization: `Bearer ${this.bearerToken}` };
  }

  async verifyOAuth1(): Promise<{ ok: boolean; error?: string; body?: string }> {
    const url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
    const auth = this.buildOAuth1Header('GET', url, {});
    if (!auth) {
      return { ok: false, error: 'OAuth1 credentials missing' };
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: auth },
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return { ok: false, error: `Twitter API error: ${response.status} ${response.statusText}`, body: text };
    }
    return { ok: true, body: text };
  }

  private async uploadInit(totalBytes: number, mediaType: string, mediaCategory?: string): Promise<string> {
    const formData = new FormData();
    formData.append('command', 'INIT');
    formData.append('total_bytes', String(totalBytes));
    formData.append('media_type', mediaType);
    if (mediaCategory) formData.append('media_category', mediaCategory);

    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media INIT failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { command: 'INIT', totalBytes, mediaType, mediaCategory },
      });
      throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${text}`.trim());
    }

    const data = (await response.json()) as { media_id_string?: string; media_id?: string };
    const mediaId = data.media_id_string || data.media_id;
    if (!mediaId) {
      throw new Error('Twitter media INIT failed');
    }
    debugLog('Twitter media INIT success', { mediaId, totalBytes, mediaType, mediaCategory });
    return mediaId;
  }

  private async uploadAppend(mediaId: string, segmentIndex: number, chunk: Buffer) {
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', String(segmentIndex));
    const blob = new Blob([chunk]);
    formData.append('media', blob, 'chunk');

    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media APPEND failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { command: 'APPEND', mediaId, segmentIndex },
      });
      throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${text}`.trim());
    }
    debugLog('Twitter media APPEND success', { mediaId, segmentIndex });
  }

  async uploadMediaFromFile(filePath: string, mediaType: string): Promise<string> {
    const stat = await fs.stat(filePath);
    const totalBytes = stat.size;
    const isVideo = mediaType.startsWith('video/');
    const isGif = mediaType === 'image/gif';
    const mediaCategory = isVideo ? 'tweet_video' : isGif ? 'tweet_gif' : 'tweet_image';

    if (!isVideo) {
      const buffer = await fs.readFile(filePath);
      return this.uploadMedia(buffer, mediaType, mediaCategory);
    }

    const mediaId = await this.uploadInit(totalBytes, mediaType, mediaCategory);
    const chunkSize = 5 * 1024 * 1024;
    const handle = await fs.open(filePath, 'r');
    try {
      let segment = 0;
      let offset = 0;
      while (offset < totalBytes) {
        const length = Math.min(chunkSize, totalBytes - offset);
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, offset);
        if (bytesRead === 0) break;
        const chunk = bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead);
        await this.uploadAppend(mediaId, segment, chunk);
        segment += 1;
        offset += bytesRead;
      }
    } finally {
      await handle.close();
    }

    const finalize = await this.uploadFinalize(mediaId);
    let info = finalize?.processing_info;
    let attempts = 0;
    while (info && (info.state === 'pending' || info.state === 'in_progress')) {
      if (attempts > 10) {
        throw new Error('Twitter media processing timeout');
      }
      const waitSeconds = Number(info.check_after_secs || 1);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      const status = await this.uploadStatus(mediaId);
      info = status?.processing_info;
      if (info?.state === 'failed') {
        throw new Error(info?.error?.message || 'Twitter media processing failed');
      }
      attempts += 1;
    }

    return mediaId;
  }

  private async uploadFinalize(mediaId: string) {
    const formData = new FormData();
    formData.append('command', 'FINALIZE');
    formData.append('media_id', mediaId);

    const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media FINALIZE failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { command: 'FINALIZE', mediaId },
      });
      throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${text}`.trim());
    }
    debugLog('Twitter media FINALIZE success', { mediaId });
    return (await response.json()) as any;
  }

  private async uploadStatus(mediaId: string) {
    const params = new URLSearchParams({
      command: 'STATUS',
      media_id: mediaId,
    });
    const url = `https://upload.twitter.com/1.1/media/upload.json?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media STATUS failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { command: 'STATUS', mediaId },
      });
      throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${text}`.trim());
    }
    return (await response.json()) as any;
  }

  /**
   * Tweet (post) to Twitter
   */
  async tweet(content: TwitterContent): Promise<{ id: string; text: string }> {
    try {
      const payload: any = {
        text: content.text,
      }

      if (content.media && content.media.length > 0) {
        payload.media = {
          media_ids: content.media.map(m => m.mediaKey),
        }
      }

      const response = await fetch(`${TWITTER_API_V2}/tweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { data: { id: string; text: string } }
      return data.data
    } catch (error) {
      throw new Error(
        `Failed to post to Twitter: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Reply to a tweet
   */
  async replyTweet(text: string, replyToTweetId: string): Promise<{ id: string; text: string }> {
    try {
      const payload: any = {
        text,
        reply: { in_reply_to_tweet_id: replyToTweetId },
      };

      const response = await fetch(`${TWITTER_API_V2}/tweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { data: { id: string; text: string } };
      return data.data;
    } catch (error) {
      throw new Error(
        `Failed to reply on Twitter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Quote a tweet
   */
  async quoteTweet(text: string, quoteTweetId: string): Promise<{ id: string; text: string }> {
    try {
      const payload: any = {
        text,
        quote_tweet_id: quoteTweetId,
      };

      const response = await fetch(`${TWITTER_API_V2}/tweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { data: { id: string; text: string } };
      return data.data;
    } catch (error) {
      throw new Error(
        `Failed to quote on Twitter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user tweets
   */
  async getTweets(userId: string, limit = 10): Promise<TwitterTweet[]> {
    try {
      const response = await fetch(
        `${TWITTER_API_V2}/users/${userId}/tweets?max_results=${limit}&tweet.fields=public_metrics,created_at,conversation_id`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { data: any[] }
      
      return data.data?.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        publicMetrics: tweet.public_metrics,
        conversationId: tweet.conversation_id,
        authorId: userId,
      })) || []
    } catch (error) {
      throw new Error(
        `Failed to fetch tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get user tweets with media (photos/videos)
   */
  async getTweetsWithMedia(
    userId: string,
    limit = 10,
    sinceId?: string
  ): Promise<
    Array<{
      id: string;
      text: string;
      createdAt: string;
      referencedTweets?: Array<{ id: string; type: string }>;
      media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
    }>
  > {
    try {
      const params = new URLSearchParams({
        max_results: String(limit),
        'tweet.fields': 'created_at,attachments,referenced_tweets',
        expansions: 'attachments.media_keys',
        'media.fields': 'type,url,preview_image_url',
      });
      if (sinceId) params.set('since_id', sinceId);

      const response = await fetch(
        `${TWITTER_API_V2}/users/${userId}/tweets?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          text: string;
          created_at: string;
          attachments?: { media_keys?: string[] };
          referenced_tweets?: Array<{ id: string; type: string }>;
        }>;
        includes?: { media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }> };
      };

      const mediaByKey = new Map<string, { type: string; url?: string; previewImageUrl?: string }>();
      for (const m of data.includes?.media || []) {
        mediaByKey.set(m.media_key, {
          type: m.type,
          url: m.url,
          previewImageUrl: m.preview_image_url,
        });
      }

      return (data.data || []).map(tweet => {
        const media =
          tweet.attachments?.media_keys?.map(key => mediaByKey.get(key)).filter(Boolean) as Array<{
            type: string;
            url?: string;
            previewImageUrl?: string;
          }> || [];
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          referencedTweets: tweet.referenced_tweets,
          media,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search recent tweets by username (with media)
   */
  async searchRecentByUsername(
    username: string,
    limit = 10,
    sinceId?: string,
    queryExtras?: string
  ): Promise<
    Array<{
      id: string;
      text: string;
      createdAt: string;
      referencedTweets?: Array<{ id: string; type: string }>;
      media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
      author?: { username?: string; name?: string };
    }>
  > {
    try {
      const query = `from:${username}${queryExtras ? ` ${queryExtras}` : ''}`;
      const params = new URLSearchParams({
        query,
        max_results: String(limit),
        'tweet.fields': 'created_at,attachments,referenced_tweets,author_id',
        expansions: 'attachments.media_keys,author_id',
        'media.fields': 'type,url,preview_image_url',
        'user.fields': 'username,name',
      });
      if (sinceId) params.set('since_id', sinceId);

      const response = await fetch(
        `${TWITTER_API_V2}/tweets/search/recent?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          text: string;
          created_at: string;
          attachments?: { media_keys?: string[] };
          referenced_tweets?: Array<{ id: string; type: string }>;
          author_id?: string;
        }>;
        includes?: {
          media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }>;
          users?: Array<{ id: string; username?: string; name?: string }>;
        };
      };

      const mediaByKey = new Map<string, { type: string; url?: string; previewImageUrl?: string }>();
      for (const m of data.includes?.media || []) {
        mediaByKey.set(m.media_key, {
          type: m.type,
          url: m.url,
          previewImageUrl: m.preview_image_url,
        });
      }
      const usersById = new Map<string, { username?: string; name?: string }>();
      for (const u of data.includes?.users || []) {
        usersById.set(u.id, { username: u.username, name: u.name });
      }

      return (data.data || []).map(tweet => {
        const media =
          tweet.attachments?.media_keys?.map(key => mediaByKey.get(key)).filter(Boolean) as Array<{
            type: string;
            url?: string;
            previewImageUrl?: string;
          }> || [];
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          referencedTweets: tweet.referenced_tweets,
          media,
          author: tweet.author_id ? usersById.get(tweet.author_id) : undefined,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to search tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search recent tweets by query (with media)
   */
  async searchRecent(
    query: string,
    limit = 10,
    sinceId?: string
  ): Promise<
    Array<{
      id: string;
      text: string;
      createdAt: string;
      referencedTweets?: Array<{ id: string; type: string }>;
      media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
      author?: { username?: string; name?: string };
    }>
  > {
    try {
      const params = new URLSearchParams({
        query,
        max_results: String(limit),
        'tweet.fields': 'created_at,attachments,referenced_tweets,author_id',
        expansions: 'attachments.media_keys,author_id',
        'media.fields': 'type,url,preview_image_url',
        'user.fields': 'username,name',
      });
      if (sinceId) params.set('since_id', sinceId);

      const response = await fetch(
        `${TWITTER_API_V2}/tweets/search/recent?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          text: string;
          created_at: string;
          attachments?: { media_keys?: string[] };
          referenced_tweets?: Array<{ id: string; type: string }>;
          author_id?: string;
        }>;
        includes?: {
          media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }>;
          users?: Array<{ id: string; username?: string; name?: string }>;
        };
      };

      const mediaByKey = new Map<string, { type: string; url?: string; previewImageUrl?: string }>();
      for (const m of data.includes?.media || []) {
        mediaByKey.set(m.media_key, {
          type: m.type,
          url: m.url,
          previewImageUrl: m.preview_image_url,
        });
      }
      const usersById = new Map<string, { username?: string; name?: string }>();
      for (const u of data.includes?.users || []) {
        usersById.set(u.id, { username: u.username, name: u.name });
      }

      return (data.data || []).map(tweet => {
        const media =
          tweet.attachments?.media_keys?.map(key => mediaByKey.get(key)).filter(Boolean) as Array<{
            type: string;
            url?: string;
            previewImageUrl?: string;
          }> || [];
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          referencedTweets: tweet.referenced_tweets,
          media,
          author: tweet.author_id ? usersById.get(tweet.author_id) : undefined,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to search tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get liked tweets by user
   */
  async getLikedTweets(
    userId: string,
    limit = 10,
    sinceId?: string
  ): Promise<
    Array<{
      id: string;
      text: string;
      createdAt: string;
      referencedTweets?: Array<{ id: string; type: string }>;
      media: Array<{ type: string; url?: string; previewImageUrl?: string }>;
      author?: { username?: string; name?: string };
    }>
  > {
    try {
      const params = new URLSearchParams({
        max_results: String(limit),
        'tweet.fields': 'created_at,attachments,referenced_tweets,author_id',
        expansions: 'attachments.media_keys,author_id',
        'media.fields': 'type,url,preview_image_url',
        'user.fields': 'username,name',
      });
      if (sinceId) params.set('since_id', sinceId);

      const response = await fetch(
        `${TWITTER_API_V2}/users/${userId}/liked_tweets?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data?: Array<{
          id: string;
          text: string;
          created_at: string;
          attachments?: { media_keys?: string[] };
          referenced_tweets?: Array<{ id: string; type: string }>;
          author_id?: string;
        }>;
        includes?: {
          media?: Array<{ media_key: string; type: string; url?: string; preview_image_url?: string }>;
          users?: Array<{ id: string; username?: string; name?: string }>;
        };
      };

      const mediaByKey = new Map<string, { type: string; url?: string; previewImageUrl?: string }>();
      for (const m of data.includes?.media || []) {
        mediaByKey.set(m.media_key, {
          type: m.type,
          url: m.url,
          previewImageUrl: m.preview_image_url,
        });
      }
      const usersById = new Map<string, { username?: string; name?: string }>();
      for (const u of data.includes?.users || []) {
        usersById.set(u.id, { username: u.username, name: u.name });
      }

      return (data.data || []).map(tweet => {
        const media =
          tweet.attachments?.media_keys?.map(key => mediaByKey.get(key)).filter(Boolean) as Array<{
            type: string;
            url?: string;
            previewImageUrl?: string;
          }> || [];
        return {
          id: tweet.id,
          text: tweet.text,
          createdAt: tweet.created_at,
          referencedTweets: tweet.referenced_tweets,
          media,
          author: tweet.author_id ? usersById.get(tweet.author_id) : undefined,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch liked tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${TWITTER_API_V2}/tweets/${tweetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      })

      return response.ok
    } catch (error) {
      throw new Error(
        `Failed to delete tweet: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Like a tweet
   */
  async likeTweet(userId: string, tweetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${TWITTER_API_V2}/users/${userId}/likes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweet_id: tweetId }),
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Retweet
   */
  async retweet(userId: string, tweetId: string): Promise<boolean> {
    try {
      const response = await fetch(`${TWITTER_API_V2}/users/${userId}/retweets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweet_id: tweetId }),
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(mediaBuffer: Buffer, mediaType: string, mediaCategory?: string): Promise<string> {
    try {
      const isVideo = mediaType.startsWith('video/');
      const isGif = mediaType === 'image/gif';
      const category = mediaCategory || (isVideo ? 'tweet_video' : isGif ? 'tweet_gif' : 'tweet_image');

      const mediaId = await this.uploadInit(mediaBuffer.length, mediaType, category);
      const chunkSize = 5 * 1024 * 1024;
      let segment = 0;
      for (let offset = 0; offset < mediaBuffer.length; offset += chunkSize) {
        const chunk = mediaBuffer.subarray(offset, Math.min(offset + chunkSize, mediaBuffer.length));
        await this.uploadAppend(mediaId, segment, chunk);
        segment += 1;
      }

      const finalize = await this.uploadFinalize(mediaId);
      let info = finalize?.processing_info;
      let attempts = 0;
      while (info && (info.state === 'pending' || info.state === 'in_progress')) {
        if (attempts > 10) {
          throw new Error('Twitter media processing timeout');
        }
        const waitSeconds = Number(info.check_after_secs || 1);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        const status = await this.uploadStatus(mediaId);
        info = status?.processing_info;
        if (info?.state === 'failed') {
          throw new Error(info?.error?.message || 'Twitter media processing failed');
        }
        attempts += 1;
      }

      return mediaId
    } catch (error) {
      debugError('Twitter uploadMedia failed', error);
      throw new Error(
        `Failed to upload media: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(username: string): Promise<{ id: string; name: string; username: string }> {
    try {
      const response = await fetch(
        `${TWITTER_API_V2}/users/by/username/${username}?user.fields=public_metrics`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { data: any }
      return {
        id: data.data.id,
        name: data.data.name,
        username: data.data.username,
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Verify API access
   */
  async verifyAccess(): Promise<boolean> {
    try {
      const response = await fetch(`${TWITTER_API_V2}/tweets/search/recent?query=from:twitter&max_results=10`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      })

      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Refresh Twitter OAuth token (OAuth 2.0)
 */
export async function refreshTwitterToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId) {
    throw new Error('Missing TWITTER_CLIENT_ID in environment');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  body.set('client_id', clientId);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers.Authorization = `Basic ${basic}`;
  }

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body,
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    // ignore
  }

  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Token refresh failed: ${text}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

/**
 * Generate Twitter OAuth URL
 */
export function generateTwitterAuthUrl(clientId: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'tweet.read tweet.write users.read follows.read follows.write media.write',
    state: crypto.randomUUID(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
}

/**
 * Generate PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const codeVerifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const buffer = new TextEncoder().encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return { codeVerifier, codeChallenge }
}
