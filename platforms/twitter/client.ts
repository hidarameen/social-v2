import { TwitterContent, TwitterTweet } from './types'
import { promises as fs } from 'fs'
import { debugError, debugLog } from '@/lib/debug'
import crypto from 'crypto'

const TWITTER_API_V2 = 'https://api.x.com/2'
const TWITTER_MEDIA_UPLOAD_V2 = 'https://api.x.com/2/media/upload'
const TWITTER_MEDIA_INITIALIZE_V2 = `${TWITTER_MEDIA_UPLOAD_V2}/initialize`
const ONE_MB = 1024 * 1024
const ONE_GIB = 1024 * 1024 * 1024
const TWITTER_IMAGE_MAX_BYTES = 5 * ONE_MB
const TWITTER_GIF_MAX_BYTES = 15 * ONE_MB
const TWITTER_STANDARD_VIDEO_MAX_BYTES = 512 * ONE_MB
const TWITTER_PREMIUM_VIDEO_MAX_BYTES = 16 * ONE_GIB
const TWITTER_STANDARD_VIDEO_MAX_DURATION_SEC = 140
const TWITTER_PREMIUM_VIDEO_MAX_DURATION_SEC = 4 * 60 * 60
const TWITTER_MEDIA_CHUNK_DEFAULT_BYTES = 1 * ONE_MB
const TWITTER_MEDIA_CHUNK_MIN_BYTES = 256 * 1024
const TWITTER_MEDIA_CHUNK_MAX_BYTES = 4 * ONE_MB
const TWITTER_MEDIA_MAX_PROCESSING_POLLS = 10
const TWITTER_APPEND_RETRYABLE_STATUSES = [408, 409, 429, 500, 502, 503, 504]

type UploadMediaOptions = {
  durationSec?: number
  premiumVideo?: boolean
}

export type TwitterOAuth1Credentials = {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
};

export class TwitterClient {
  private bearerToken: string
  private oauth1Credentials?: TwitterOAuth1Credentials;

  constructor(bearerToken: string, options?: { oauth1Credentials?: TwitterOAuth1Credentials }) {
    this.bearerToken = bearerToken
    this.oauth1Credentials = options?.oauth1Credentials;
  }

  private getUserAccessToken(context: string): string {
    const token = (this.bearerToken || '').trim();
    if (!token || token === 'manual' || token.startsWith('oauth_')) {
      throw new Error(
        `Missing valid Twitter user token for ${context}. Reconnect the Twitter account with OAuth scopes: tweet.write users.read media.write offline.access.`
      );
    }
    return token;
  }

  private getMediaUploadHeaders(context: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getUserAccessToken(context)}`,
    };
  }

  private parseEnvBoolean(value?: string): boolean {
    const normalized = (value || '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }

  private isPremiumVideoEnabled(override?: boolean): boolean {
    if (typeof override === 'boolean') return override;
    return this.parseEnvBoolean(process.env.TWITTER_PREMIUM_VIDEO_DEFAULT);
  }

  private getConfiguredChunkSize(): number {
    const raw = (process.env.TWITTER_MEDIA_CHUNK_BYTES || '').trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      const clamped = Math.min(
        TWITTER_MEDIA_CHUNK_MAX_BYTES,
        Math.max(TWITTER_MEDIA_CHUNK_MIN_BYTES, Math.floor(parsed))
      );
      return clamped;
    }
    return TWITTER_MEDIA_CHUNK_DEFAULT_BYTES;
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    const rounded = value >= 100 ? Math.round(value) : Number(value.toFixed(1));
    return `${rounded} ${units[unit]}`;
  }

  private parseStatusFromError(error: unknown): number | undefined {
    const message = error instanceof Error ? error.message : String(error || '');
    const match = message.match(/Twitter API error:\s*(\d{3})/i) || message.match(/\b(\d{3})\s+[A-Za-z]/);
    if (!match) return undefined;
    const status = Number(match[1]);
    return Number.isFinite(status) ? status : undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getVideoUploadLimits(premiumVideo?: boolean) {
    const premium = this.isPremiumVideoEnabled(premiumVideo);
    return premium
      ? {
          premium: true,
          maxBytes: TWITTER_PREMIUM_VIDEO_MAX_BYTES,
          maxDurationSec: TWITTER_PREMIUM_VIDEO_MAX_DURATION_SEC,
        }
      : {
          premium: false,
          maxBytes: TWITTER_STANDARD_VIDEO_MAX_BYTES,
          maxDurationSec: TWITTER_STANDARD_VIDEO_MAX_DURATION_SEC,
        };
  }

  private resolveMediaCategory(
    mediaType: string,
    totalBytes: number,
    options?: UploadMediaOptions
  ): 'tweet_image' | 'tweet_gif' | 'tweet_video' | 'amplify_video' {
    if (mediaType === 'image/gif') return 'tweet_gif';
    if (!mediaType.startsWith('video/')) return 'tweet_image';

    const limits = this.getVideoUploadLimits(options?.premiumVideo);
    const durationSec = options?.durationSec;
    const needsLongVideoCategory =
      limits.premium &&
      (totalBytes > TWITTER_STANDARD_VIDEO_MAX_BYTES ||
        (typeof durationSec === 'number' && durationSec > TWITTER_STANDARD_VIDEO_MAX_DURATION_SEC));

    return needsLongVideoCategory ? 'amplify_video' : 'tweet_video';
  }

  private validateMediaUploadLimits(totalBytes: number, mediaType: string, options?: UploadMediaOptions) {
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error('Media file is empty or invalid');
    }

    if (mediaType === 'image/gif' && totalBytes > TWITTER_GIF_MAX_BYTES) {
      throw new Error(
        `GIF exceeds Twitter API limit: ${this.formatBytes(totalBytes)} > ${this.formatBytes(TWITTER_GIF_MAX_BYTES)}`
      );
    }

    if (mediaType.startsWith('image/') && mediaType !== 'image/gif' && totalBytes > TWITTER_IMAGE_MAX_BYTES) {
      throw new Error(
        `Image exceeds Twitter API limit: ${this.formatBytes(totalBytes)} > ${this.formatBytes(TWITTER_IMAGE_MAX_BYTES)}`
      );
    }

    if (!mediaType.startsWith('video/')) return;

    const limits = this.getVideoUploadLimits(options?.premiumVideo);
    if (totalBytes > limits.maxBytes) {
      const hint = limits.premium
        ? 'Premium mode supports up to 16 GB / 4 hours.'
        : 'Enable Premium mode for long videos (set TWITTER_PREMIUM_VIDEO_DEFAULT=true or pass premiumVideo=true).';
      throw new Error(
        `Video exceeds configured limit: ${this.formatBytes(totalBytes)} > ${this.formatBytes(limits.maxBytes)}. ${hint}`
      );
    }

    if (typeof options?.durationSec === 'number' && options.durationSec > limits.maxDurationSec) {
      const hint = limits.premium
        ? 'Premium mode supports up to 4 hours.'
        : 'Enable Premium mode for videos longer than 140 seconds.';
      throw new Error(
        `Video duration exceeds configured limit: ${options.durationSec}s > ${limits.maxDurationSec}s. ${hint}`
      );
    }
  }

  private extractMediaId(payload: any): string | undefined {
    const mediaId =
      payload?.data?.id ||
      payload?.media_id_string ||
      payload?.media_id;
    return mediaId ? String(mediaId) : undefined;
  }

  private extractProcessingInfo(payload: any): any {
    return payload?.data?.processing_info || payload?.processing_info;
  }

  private shortenTweetText(text: string): string {
    if (text.length <= 32) return text;

    const trimmed = text.trim();
    const trailingUrlMatch = trimmed.match(/(?:\s|^)(https?:\/\/\S+)\s*$/i);
    const trailingUrl = trailingUrlMatch?.[1];
    const separator = '\n\n';
    const nextLength = Math.max(32, Math.floor(trimmed.length * 0.85));

    if (!trailingUrl) {
      const shortened = trimmed.slice(0, nextLength).trimEnd().replace(/\.*$/, '');
      return shortened ? `${shortened}...` : trimmed;
    }

    const head = trimmed.slice(0, trailingUrlMatch?.index ?? trimmed.length).trimEnd();
    const reserved = trailingUrl.length + separator.length;
    const maxHeadLength = Math.max(0, nextLength - reserved);

    let nextHead = head;
    if (nextHead.length > maxHeadLength) {
      if (maxHeadLength <= 3) {
        nextHead = '';
      } else {
        nextHead = `${nextHead.slice(0, maxHeadLength - 3).trimEnd()}...`;
      }
    }

    if (!nextHead) {
      return trailingUrl;
    }
    return `${nextHead}${separator}${trailingUrl}`;
  }

  private isTweetLengthError(status: number, bodyText: string): boolean {
    if (status !== 400 && status !== 403) return false;
    const body = (bodyText || '').toLowerCase();
    return (
      body.includes('too long') ||
      body.includes('text is too long') ||
      body.includes('text length') ||
      body.includes('280')
    );
  }

  private isLikelyLengthPermissionError(status: number, bodyText: string, text: string): boolean {
    if (status !== 403) return false;
    if ((text || '').length <= 280) return false;
    const body = (bodyText || '').toLowerCase();
    return (
      body.includes('not permitted to perform this action') ||
      (body.includes('"title":"forbidden"') && body.includes('"type":"about:blank"'))
    );
  }

  private isDuplicateTweetError(status: number, bodyText: string): boolean {
    if (status !== 403 && status !== 400) return false;
    const body = (bodyText || '').toLowerCase();
    return (
      body.includes('duplicate content') ||
      body.includes('status is a duplicate') ||
      body.includes('you are not allowed to create a tweet with duplicate content')
    );
  }

  private createDuplicateVariant(text: string, attempt: number): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    const token = `${Date.now().toString(36)}${attempt}`;
    const trailingUrlMatch = trimmed.match(/(?:\s|^)(https?:\/\/\S+)\s*$/i);

    if (trailingUrlMatch) {
      const trailingUrl = trailingUrlMatch[1];
      try {
        const parsed = new URL(trailingUrl);
        parsed.searchParams.set('sfv', token);
        const head = trimmed.slice(0, trailingUrlMatch.index ?? trimmed.length).trimEnd();
        return head ? `${head}\n\n${parsed.toString()}` : parsed.toString();
      } catch {
        // fallback below
      }
    }

    const marker = ` [${token}]`;
    if (trimmed.length + marker.length <= 280) {
      return `${trimmed}${marker}`;
    }
    const next = `${trimmed.slice(0, Math.max(0, 280 - marker.length - 3)).trimEnd()}...${marker}`;
    return next.slice(0, 280);
  }

  private getMediaAppendUrl(mediaId: string): string {
    return `${TWITTER_MEDIA_UPLOAD_V2}/${encodeURIComponent(mediaId)}/append`;
  }

  private getMediaFinalizeUrl(mediaId: string): string {
    return `${TWITTER_MEDIA_UPLOAD_V2}/${encodeURIComponent(mediaId)}/finalize`;
  }

  private getOAuth1Credentials() {
    const consumerKey = this.oauth1Credentials?.consumerKey;
    const consumerSecret = this.oauth1Credentials?.consumerSecret;
    const token = this.oauth1Credentials?.token;
    const tokenSecret = this.oauth1Credentials?.tokenSecret;

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
    const oauthHeaderParams: Record<string, string> = {
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

  private async uploadInit(totalBytes: number, mediaType: string, mediaCategory?: string): Promise<{ mediaId: string; processingInfo?: any }> {
    const payload: Record<string, any> = {
      total_bytes: totalBytes,
      media_type: mediaType,
    };
    if (mediaCategory) payload.media_category = mediaCategory;

    debugLog('Twitter media upload auth context', {
      endpoint: TWITTER_MEDIA_INITIALIZE_V2,
      hasToken: Boolean((this.bearerToken || '').trim()),
      usesPlaceholderToken:
        (this.bearerToken || '').trim() === 'manual' ||
        (this.bearerToken || '').trim().startsWith('oauth_'),
      mediaType,
      mediaCategory,
      totalBytes,
    });

    const response = await fetch(TWITTER_MEDIA_INITIALIZE_V2, {
      method: 'POST',
      headers: {
        ...this.getMediaUploadHeaders('media upload INIT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media INIT failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: payload,
      });
      throw new Error(
        `Twitter media INIT failed (${response.status} ${response.statusText}) ${text}`.trim()
      );
    }

    const data = await response.json();
    const mediaId = this.extractMediaId(data);
    if (!mediaId) {
      throw new Error('Twitter media INIT failed');
    }
    debugLog('Twitter media INIT success', { mediaId, totalBytes, mediaType, mediaCategory });
    return { mediaId, processingInfo: this.extractProcessingInfo(data) };
  }

  private async uploadAppend(mediaId: string, segmentIndex: number, chunk: Buffer) {
    const formData = new FormData();
    formData.append('segment_index', String(segmentIndex));
    const blob = new Blob([new Uint8Array(chunk)]);
    formData.append('media', blob, 'chunk');

    const response = await fetch(this.getMediaAppendUrl(mediaId), {
      method: 'POST',
      headers: this.getMediaUploadHeaders('media upload APPEND'),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media APPEND failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { mediaId, segmentIndex, chunkBytes: chunk.length },
      });
      throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${text}`.trim());
    }
    debugLog('Twitter media APPEND success', { mediaId, segmentIndex });
  }

  private async uploadAppendWithRetry(mediaId: string, segmentIndex: number, chunk: Buffer) {
    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        await this.uploadAppend(mediaId, segmentIndex, chunk);
        return;
      } catch (error) {
        const status = this.parseStatusFromError(error);
        const retryable = status ? TWITTER_APPEND_RETRYABLE_STATUSES.includes(status) : false;
        if (!retryable || attempt >= maxAttempts - 1) {
          throw error;
        }
        const waitMs = 500 * Math.pow(2, attempt);
        debugLog('Twitter media APPEND retry', {
          mediaId,
          segmentIndex,
          status,
          attempt: attempt + 1,
          waitMs,
        });
        await this.sleep(waitMs);
      }
      attempt += 1;
    }
  }

  async uploadMediaFromFile(filePath: string, mediaType: string, options: UploadMediaOptions = {}): Promise<string> {
    const stat = await fs.stat(filePath);
    const totalBytes = stat.size;
    const isVideo = mediaType.startsWith('video/');
    this.validateMediaUploadLimits(totalBytes, mediaType, options);
    const mediaCategory = this.resolveMediaCategory(mediaType, totalBytes, options);
    let chunkSize = this.getConfiguredChunkSize();
    debugLog('Twitter media upload limits resolved', {
      filePath,
      mediaType,
      totalBytes,
      mediaCategory,
      chunkSize,
      premiumVideo: this.isPremiumVideoEnabled(options.premiumVideo),
      durationSec: options.durationSec,
    });

    const { mediaId, processingInfo } = await this.uploadInit(totalBytes, mediaType, mediaCategory);

    if (!isVideo) {
      const buffer = await fs.readFile(filePath);
      await this.uploadAppendWithRetry(mediaId, 0, buffer);
    } else {
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
          try {
            await this.uploadAppendWithRetry(mediaId, segment, chunk);
          } catch (error) {
            const status = this.parseStatusFromError(error);
            if (status === 413 && chunkSize > TWITTER_MEDIA_CHUNK_MIN_BYTES) {
              const nextChunkSize = Math.max(TWITTER_MEDIA_CHUNK_MIN_BYTES, Math.floor(chunkSize / 2));
              debugLog('Twitter media APPEND chunk size reduced after 413', {
                mediaId,
                segmentIndex: segment,
                previousChunkSize: chunkSize,
                nextChunkSize,
              });
              chunkSize = nextChunkSize;
              continue;
            }
            if (status === 413) {
              throw new Error(
                `Twitter APPEND failed with 413 Payload Too Large at chunk ${this.formatBytes(chunk.length)}. Configure TWITTER_MEDIA_CHUNK_BYTES (current ${chunkSize}) to a smaller value.`
              );
            }
            throw error;
          }
          segment += 1;
          offset += bytesRead;
        }
      } finally {
        await handle.close();
      }
    }

    const finalize = await this.uploadFinalize(mediaId);
    let info = this.extractProcessingInfo(finalize) || processingInfo;
    let attempts = 0;
    while (info && (info.state === 'pending' || info.state === 'in_progress')) {
      if (attempts > TWITTER_MEDIA_MAX_PROCESSING_POLLS) {
        throw new Error('Twitter media processing timeout');
      }
      const waitSeconds = Number(info.check_after_secs || 1);
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      const status = await this.uploadStatus(mediaId);
      info = this.extractProcessingInfo(status);
      if (info?.state === 'failed') {
        throw new Error(info?.error?.message || 'Twitter media processing failed');
      }
      attempts += 1;
    }

    return mediaId;
  }

  private async uploadFinalize(mediaId: string) {
    const response = await fetch(this.getMediaFinalizeUrl(mediaId), {
      method: 'POST',
      headers: this.getMediaUploadHeaders('media upload FINALIZE'),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      debugError('Twitter media FINALIZE failed', null, {
        status: response.status,
        statusText: response.statusText,
        body: text,
        request: { mediaId },
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
    const url = `${TWITTER_MEDIA_UPLOAD_V2}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getMediaUploadHeaders('media upload STATUS'),
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
      let text = (content.text || '').trim();

      const mediaIds = content.media && content.media.length > 0
        ? content.media.map(m => m.mediaKey)
        : undefined;

      let attempts = 0;
      while (attempts < 5) {
        const payload: any = {};
        if (text) {
          payload.text = text;
        }
        if (mediaIds && mediaIds.length > 0) {
          payload.media = { media_ids: mediaIds };
        }
        if (!payload.text && !payload.media) {
          throw new Error('Tweet payload is empty');
        }

        const response = await fetch(`${TWITTER_API_V2}/tweets`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const bodyText = await response.text().catch(() => '');
        if (response.ok) {
          let data: { data?: { id?: string; text?: string } } | null = null;
          if (bodyText) {
            try {
              data = JSON.parse(bodyText) as { data?: { id?: string; text?: string } };
            } catch {
              data = null;
            }
          }
          if (!data?.data?.id) {
            throw new Error('Twitter API returned an unexpected response');
          }
          return { id: data.data.id, text: data.data.text || text };
        }

        const shouldShortenForLength =
          this.isTweetLengthError(response.status, bodyText) ||
          this.isLikelyLengthPermissionError(response.status, bodyText, text);

        if (shouldShortenForLength && text.length > 32 && attempts < 4) {
          const nextText = this.shortenTweetText(text);
          if (nextText.length >= text.length) {
            throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${bodyText}`.trim());
          }
          debugLog('Twitter tweet text shortened after length error', {
            status: response.status,
            bodySnippet: bodyText.slice(0, 200),
            previousLength: text.length,
            nextLength: nextText.length,
            attempt: attempts + 1,
          });
          text = nextText;
          attempts += 1;
          continue;
        }

        if (this.isDuplicateTweetError(response.status, bodyText) && attempts < 4) {
          const nextText = this.createDuplicateVariant(text, attempts + 1);
          if (nextText === text) {
            throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${bodyText}`.trim());
          }
          debugLog('Twitter tweet text adjusted after duplicate-content error', {
            status: response.status,
            previousLength: text.length,
            nextLength: nextText.length,
            attempt: attempts + 1,
          });
          text = nextText;
          attempts += 1;
          continue;
        }

        throw new Error(`Twitter API error: ${response.status} ${response.statusText} ${bodyText}`.trim());
      }

      throw new Error('Twitter API error: text could not be shortened to an acceptable length');
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
  async uploadMedia(mediaBuffer: Buffer, mediaType: string, mediaCategory?: string, options: UploadMediaOptions = {}): Promise<string> {
    try {
      const isVideo = mediaType.startsWith('video/');
      const isGif = mediaType === 'image/gif';
      this.validateMediaUploadLimits(mediaBuffer.length, mediaType, options);
      const category = mediaCategory || this.resolveMediaCategory(mediaType, mediaBuffer.length, options);
      let chunkSize = this.getConfiguredChunkSize();
      if (!isVideo && !isGif) {
        chunkSize = mediaBuffer.length;
      }
      debugLog('Twitter media buffer upload limits resolved', {
        mediaType,
        totalBytes: mediaBuffer.length,
        mediaCategory: category,
        chunkSize,
        premiumVideo: this.isPremiumVideoEnabled(options.premiumVideo),
        durationSec: options.durationSec,
      });

      const { mediaId } = await this.uploadInit(mediaBuffer.length, mediaType, category);
      let segment = 0;
      let offset = 0;
      while (offset < mediaBuffer.length) {
        const chunk = mediaBuffer.subarray(offset, Math.min(offset + chunkSize, mediaBuffer.length));
        try {
          await this.uploadAppendWithRetry(mediaId, segment, chunk);
        } catch (error) {
          const status = this.parseStatusFromError(error);
          if (status === 413 && chunkSize > TWITTER_MEDIA_CHUNK_MIN_BYTES) {
            const nextChunkSize = Math.max(TWITTER_MEDIA_CHUNK_MIN_BYTES, Math.floor(chunkSize / 2));
            debugLog('Twitter media APPEND chunk size reduced after 413', {
              mediaId,
              segmentIndex: segment,
              previousChunkSize: chunkSize,
              nextChunkSize,
            });
            chunkSize = nextChunkSize;
            continue;
          }
          if (status === 413) {
            throw new Error(
              `Twitter APPEND failed with 413 Payload Too Large at chunk ${this.formatBytes(chunk.length)}. Configure TWITTER_MEDIA_CHUNK_BYTES (current ${chunkSize}) to a smaller value.`
            );
          }
          throw error;
        }
        offset += chunk.length;
        segment += 1;
      }

      const finalize = await this.uploadFinalize(mediaId);
      let info = this.extractProcessingInfo(finalize);
      let attempts = 0;
      while (info && (info.state === 'pending' || info.state === 'in_progress')) {
        if (attempts > TWITTER_MEDIA_MAX_PROCESSING_POLLS) {
          throw new Error('Twitter media processing timeout');
        }
        const waitSeconds = Number(info.check_after_secs || 1);
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        const status = await this.uploadStatus(mediaId);
        info = this.extractProcessingInfo(status);
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
export async function refreshTwitterToken(
  refreshToken: string,
  credentials: { clientId: string; clientSecret?: string }
): Promise<{ accessToken: string; refreshToken?: string }> {
  const clientId = credentials.clientId?.trim();
  const clientSecret = credentials.clientSecret?.trim();
  if (!clientId) {
    throw new Error('Missing Twitter client ID in platform credentials');
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
