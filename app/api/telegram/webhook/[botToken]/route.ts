import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TwitterClient } from '@/platforms/twitter/client';
import { TelegramClient } from '@/platforms/telegram/client';
import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { debugLog, debugError } from '@/lib/debug';

export const runtime = 'nodejs';

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    video?: { file_id: string; file_unique_id: string; width?: number; height?: number; duration?: number; mime_type?: string; file_size?: number };
    document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
  channel_post?: {
    message_id: number;
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    video?: { file_id: string; file_unique_id: string; width?: number; height?: number; duration?: number; mime_type?: string; file_size?: number };
    document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number };
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
};

function extractMessage(update: TelegramUpdate) {
  return update.message || update.channel_post || null;
}

function pickTelegramMedia(message: NonNullable<ReturnType<typeof extractMessage>>) {
  if (message.photo && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    return { kind: 'photo' as const, fileId: largest.file_id, mimeType: 'image/jpeg' };
  }
  if (message.video?.file_id) {
    return { kind: 'video' as const, fileId: message.video.file_id, mimeType: message.video.mime_type || 'video/mp4' };
  }
  if (message.document?.file_id && message.document.mime_type?.startsWith('image/')) {
    return { kind: 'photo' as const, fileId: message.document.file_id, mimeType: message.document.mime_type };
  }
  if (message.document?.file_id && message.document.mime_type?.startsWith('video/')) {
    return { kind: 'video' as const, fileId: message.document.file_id, mimeType: message.document.mime_type };
  }
  return null;
}

async function fetchTelegramFileToTemp(botToken: string, fileId: string) {
  const metaRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!metaRes.ok) {
    throw new Error(`Telegram API error: ${metaRes.statusText}`);
  }
  const meta = (await metaRes.json()) as any;
  const filePath = meta?.result?.file_path;
  if (!filePath) {
    throw new Error('Telegram file path missing');
  }
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: ${fileRes.statusText}`);
  }
  const tempPath = `/tmp/telegram-media-${randomUUID()}`;
  const stream = fileRes.body ? Readable.fromWeb(fileRes.body as any) : null;
  if (!stream) {
    throw new Error('Telegram file stream missing');
  }
  await pipeline(stream, createWriteStream(tempPath));
  const stat = await fs.stat(tempPath);
  return { tempPath, fileUrl, size: stat.size };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botToken: string }> }
) {
  const { botToken } = await params;
  if (!botToken) {
    return NextResponse.json({ success: false, error: 'Missing bot token' }, { status: 400 });
  }
  debugLog('Telegram webhook received', { botTokenPrefix: botToken.slice(0, 8) });

  const accounts = await db.getAllAccounts();
  const account = accounts.find(
    a => a.platformId === 'telegram' && a.accessToken === botToken
  );
  if (!account) {
    debugLog('Telegram webhook ignored: bot not found');
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }
  if (!account.isActive) {
    debugLog('Telegram webhook ignored: bot inactive', { accountId: account.id });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = (account.credentials as any)?.webhookSecret;
  if (expectedSecret && secretHeader !== expectedSecret) {
    debugLog('Telegram webhook ignored: invalid secret', { accountId: account.id });
    return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    debugLog('Telegram webhook invalid payload');
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const message = extractMessage(update);
  if (!message) {
    debugLog('Telegram webhook ignored: no message');
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const chatId = message.chat?.id?.toString();
  const configuredChatId = (account.credentials as any)?.chatId?.toString();
  if (configuredChatId && chatId && configuredChatId !== chatId) {
    debugLog('Telegram webhook ignored: chat mismatch', { configuredChatId, chatId });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const text = message.text || message.caption || '';
  const media = pickTelegramMedia(message);
  if (!text && !media) {
    debugLog('Telegram webhook ignored: no text/caption and no media', { messageId: message.message_id });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }
  if (!text && media) {
    debugLog('Telegram webhook: media without caption', { messageId: message.message_id, mediaKind: media.kind });
  }
  debugLog('Telegram message accepted', {
    messageId: message.message_id,
    chatId,
    hasMedia: Boolean(media),
    mediaKind: media?.kind,
  });

  const userTasks = await db.getUserTasks(account.userId);
  const activeTasks = userTasks.filter(
    t => t.status === 'active' && t.sourceAccounts.includes(account.id)
  );

  if (activeTasks.length === 0) {
    debugLog('Telegram webhook ignored: no active tasks', { accountId: account.id });
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const userAccounts = await db.getUserAccounts(account.userId);
  const accountsById = new Map(userAccounts.map(a => [a.id, a]));

  for (const task of activeTasks) {
    const targets = task.targetAccounts
      .map(id => accountsById.get(id))
      .filter((a): a is typeof account => Boolean(a))
      .filter(a => a.isActive);

    let failures = 0;

    for (const target of targets) {
      let status: 'success' | 'failed' = 'success';
      let errorMessage: string | undefined;
      let responseData: any = undefined;

      try {
        if (target.platformId === 'twitter') {
          debugLog('Telegram -> Twitter start', { taskId: task.id, targetId: target.id });
          const client = new TwitterClient(target.accessToken);
          if (media) {
            const { tempPath } = await fetchTelegramFileToTemp(botToken, media.fileId);
            try {
              debugLog('Telegram media downloaded', { taskId: task.id, tempPath });
              const mediaId = await client.uploadMediaFromFile(tempPath, media.mimeType);
              debugLog('Twitter media uploaded', { taskId: task.id, mediaId });
              const result = await client.tweet({
                text,
                media: [{ mediaKey: mediaId }],
              });
              debugLog('Twitter tweet posted', { taskId: task.id, tweetId: result.id });
              responseData = { id: result.id, mediaId };
            } finally {
              await fs.unlink(tempPath).catch(() => undefined);
            }
          } else {
            const result = await client.tweet({ text });
            debugLog('Twitter tweet posted (no media)', { taskId: task.id, tweetId: result.id });
            responseData = { id: result.id };
          }
        } else if (target.platformId === 'telegram') {
          debugLog('Telegram -> Telegram start', { taskId: task.id, targetId: target.id });
          const targetChatId = (target.credentials as any)?.chatId;
          if (!targetChatId) {
            throw new Error('Missing Telegram target chat ID');
          }
          const client = new TelegramClient(target.accessToken);
          const result = await client.sendMessage(targetChatId, text);
          debugLog('Telegram message forwarded', { taskId: task.id, messageId: result.messageId });
          responseData = { messageId: result.messageId };
        } else {
          throw new Error(`Target platform not supported yet: ${target.platformId}`);
        }
      } catch (error) {
        status = 'failed';
        failures += 1;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        debugError('Telegram webhook target failed', error, { taskId: task.id, targetId: target.id });
      }

      await db.createExecution({
        taskId: task.id,
        sourceAccount: account.id,
        targetAccount: target.id,
        originalContent: text,
        transformedContent: text,
        status,
        error: errorMessage,
        executedAt: new Date(),
        responseData,
      });
    }

    await db.updateTask(task.id, {
      executionCount: (task.executionCount ?? 0) + 1,
      failureCount: (task.failureCount ?? 0) + failures,
      lastExecuted: new Date(),
      lastError: failures > 0 ? 'One or more targets failed' : undefined,
    });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
