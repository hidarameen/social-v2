import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TwitterClient } from '@/platforms/twitter/client';
import { TelegramClient } from '@/platforms/telegram/client';

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    caption?: string;
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
  channel_post?: {
    message_id: number;
    text?: string;
    caption?: string;
    chat?: { id: number | string; title?: string; username?: string; type?: string };
  };
};

function extractMessage(update: TelegramUpdate) {
  return update.message || update.channel_post || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botToken: string }> }
) {
  const { botToken } = await params;
  if (!botToken) {
    return NextResponse.json({ success: false, error: 'Missing bot token' }, { status: 400 });
  }

  const accounts = await db.getAllAccounts();
  const account = accounts.find(
    a => a.platformId === 'telegram' && a.accessToken === botToken
  );
  if (!account) {
    return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }
  if (!account.isActive) {
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = (account.credentials as any)?.webhookSecret;
  if (expectedSecret && secretHeader !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Invalid secret' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }

  const message = extractMessage(update);
  if (!message) {
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const chatId = message.chat?.id?.toString();
  const configuredChatId = (account.credentials as any)?.chatId?.toString();
  if (configuredChatId && chatId && configuredChatId !== chatId) {
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const text = message.text || message.caption;
  if (!text) {
    return NextResponse.json({ success: true, ignored: true }, { status: 200 });
  }

  const userTasks = await db.getUserTasks(account.userId);
  const activeTasks = userTasks.filter(
    t => t.status === 'active' && t.sourceAccounts.includes(account.id)
  );

  if (activeTasks.length === 0) {
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
          const client = new TwitterClient(target.accessToken);
          const result = await client.tweet({ text });
          responseData = { id: result.id };
        } else if (target.platformId === 'telegram') {
          const targetChatId = (target.credentials as any)?.chatId;
          if (!targetChatId) {
            throw new Error('Missing Telegram target chat ID');
          }
          const client = new TelegramClient(target.accessToken);
          const result = await client.sendMessage(targetChatId, text);
          responseData = { messageId: result.messageId };
        } else {
          throw new Error(`Target platform not supported yet: ${target.platformId}`);
        }
      } catch (error) {
        status = 'failed';
        failures += 1;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
