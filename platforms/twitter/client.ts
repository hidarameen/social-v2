import { TwitterContent, TwitterTweet } from './types'

const TWITTER_API_V2 = 'https://api.twitter.com/2'

export class TwitterClient {
  private bearerToken: string

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken
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
    }>
  > {
    try {
      const query = `from:${username}${queryExtras ? ` ${queryExtras}` : ''}`;
      const params = new URLSearchParams({
        query,
        max_results: String(limit),
        'tweet.fields': 'created_at,attachments,referenced_tweets',
        expansions: 'attachments.media_keys',
        'media.fields': 'type,url,preview_image_url',
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
        `Failed to search tweets: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  async uploadMedia(mediaBuffer: Buffer, mediaType: string): Promise<string> {
    try {
      const formData = new FormData()
      const blob = new Blob([mediaBuffer], { type: mediaType })
      formData.append('media_data', blob as any)

      const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { media_id_string: string }
      return data.media_id_string
    } catch (error) {
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
    scope: 'tweet.read tweet.write users.read follows.read follows.write',
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
