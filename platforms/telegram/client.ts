// Telegram Platform client
import { buildTelegramBotMethodUrl, getTelegramApiBaseUrl } from '@/lib/telegram-api';

export class TelegramClient {
  private botToken: string
  private apiBaseUrl: string

  constructor(botToken: string, apiBaseUrl?: string) {
    this.botToken = botToken
    this.apiBaseUrl = getTelegramApiBaseUrl(apiBaseUrl)
  }

  private getTelegramUrl(method: string): string {
    return buildTelegramBotMethodUrl(this.botToken, method, this.apiBaseUrl)
  }

  /**
   * Send a text message
   */
  async sendMessage(chatId: string, text: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'): Promise<{ messageId: number }> {
    try {
      const response = await fetch(this.getTelegramUrl('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode || 'HTML',
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return { messageId: data.result.message_id }
    } catch (error) {
      throw new Error(
        `Failed to send Telegram message: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Send a photo
   */
  async sendPhoto(
    chatId: string,
    photoUrl: string,
    caption?: string,
    parseMode?: 'HTML' | 'Markdown'
  ): Promise<{ messageId: number }> {
    try {
      const response = await fetch(this.getTelegramUrl('sendPhoto'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          parse_mode: parseMode || 'HTML',
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return { messageId: data.result.message_id }
    } catch (error) {
      throw new Error(
        `Failed to send Telegram photo: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Send a video
   */
  async sendVideo(
    chatId: string,
    videoUrl: string,
    caption?: string,
    duration?: number
  ): Promise<{ messageId: number }> {
    try {
      const response = await fetch(this.getTelegramUrl('sendVideo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: videoUrl,
          caption,
          duration,
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return { messageId: data.result.message_id }
    } catch (error) {
      throw new Error(
        `Failed to send Telegram video: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Send a video file (multipart upload)
   */
  async sendVideoFile(
    chatId: string,
    videoPath: string,
    caption?: string,
    duration?: number,
    thumbnailPath?: string
  ): Promise<{ messageId: number }> {
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('supports_streaming', 'true');
      if (caption) formData.append('caption', caption);
      if (duration) formData.append('duration', String(duration));

      const videoResponse = await fetch(`file://${videoPath}`);
      const videoBlob = await videoResponse.blob();
      formData.append('video', videoBlob, 'video.mp4');

      if (thumbnailPath) {
        const thumbResponse = await fetch(`file://${thumbnailPath}`);
        const thumbBlob = await thumbResponse.blob();
        formData.append('thumbnail', thumbBlob, 'thumb.jpg');
      }

      const response = await fetch(this.getTelegramUrl('sendVideo'), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      if (process.env.TELEGRAM_LOG_RESPONSES === 'true') {
        console.log('[Telegram] sendVideo response:', data);
      }
      return { messageId: data.result.message_id };
    } catch (error) {
      throw new Error(
        `Failed to send Telegram video: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send media group (multiple photos/videos)
   */
  async sendMediaGroup(chatId: string, media: Array<{ type: 'photo' | 'video'; media: string; caption?: string }>): Promise<{ messageIds: number[] }> {
    try {
      const response = await fetch(this.getTelegramUrl('sendMediaGroup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          media: media.map(m => ({
            type: m.type,
            media: m.media,
            caption: m.caption,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return { messageIds: data.result.map((m: any) => m.message_id) }
    } catch (error) {
      throw new Error(
        `Failed to send Telegram media group: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(chatId: string, messageId: number): Promise<boolean> {
    try {
      const response = await fetch(this.getTelegramUrl('deleteMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Edit message text
   */
  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
    parseMode?: 'HTML' | 'Markdown'
  ): Promise<boolean> {
    try {
      const response = await fetch(this.getTelegramUrl('editMessageText'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: parseMode || 'HTML',
        }),
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Get channel/group info
   */
  async getChat(chatId: string): Promise<{ chatId: string; title: string; type: string; memberCount?: number }> {
    try {
      const response = await fetch(this.getTelegramUrl('getChat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      const chat = data.result

      return {
        chatId: chat.id,
        title: chat.title || chat.first_name || 'DM',
        type: chat.type,
        memberCount: chat.member_count,
      }
    } catch (error) {
      throw new Error(
        `Failed to fetch chat info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Verify bot token
   */
  async verifyToken(): Promise<boolean> {
    try {
      const response = await fetch(this.getTelegramUrl('getMe'))
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<{ botId: string; username: string }> {
    try {
      const response = await fetch(this.getTelegramUrl('getMe'))

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return {
        botId: data.result.id,
        username: data.result.username,
      }
    } catch (error) {
      throw new Error(
        `Failed to get bot info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Forward message
   */
  async forwardMessage(fromChatId: string, toChatId: string, messageId: number): Promise<{ messageId: number }> {
    try {
      const response = await fetch(this.getTelegramUrl('forwardMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_chat_id: fromChatId,
          chat_id: toChatId,
          message_id: messageId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`)
      }

      const data = (await response.json()) as any
      return { messageId: data.result.message_id }
    } catch (error) {
      throw new Error(
        `Failed to forward message: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}
