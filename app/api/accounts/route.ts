import { NextRequest, NextResponse } from 'next/server'
import { db, type PlatformAccount } from '@/lib/db'
import { randomUUID } from 'crypto'
import { getAuthUser } from '@/lib/auth'
import { getClientKey, rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { parsePagination, parseSort } from '@/lib/validation'
import {
  buildTelegramBotFileUrl,
  buildTelegramBotMethodUrl,
  getTelegramApiBaseUrl,
} from '@/lib/telegram-api'

export const runtime = 'nodejs';

async function fetchTelegramBotProfileImage(botToken: string, botId?: string | number): Promise<string | undefined> {
  if (!botToken || typeof botId === 'undefined' || botId === null) return undefined;
  const telegramApiBaseUrl = getTelegramApiBaseUrl();

  try {
    const photosRes = await fetch(buildTelegramBotMethodUrl(botToken, 'getUserProfilePhotos', telegramApiBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: Number(botId),
        limit: 1,
      }),
    });
    const photosData = await photosRes.json().catch(() => null);
    const firstPhoto = photosData?.result?.photos?.[0];
    const bestSize = Array.isArray(firstPhoto) && firstPhoto.length > 0
      ? firstPhoto[firstPhoto.length - 1]
      : undefined;
    const fileId = bestSize?.file_id;
    if (!fileId) return undefined;

    const fileRes = await fetch(buildTelegramBotMethodUrl(botToken, 'getFile', telegramApiBaseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const fileData = await fileRes.json().catch(() => null);
    const filePath = fileData?.result?.file_path;
    if (!filePath) return undefined;

    const fileUrl = buildTelegramBotFileUrl(botToken, filePath, telegramApiBaseUrl);
    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) return undefined;

    const buffer = Buffer.from(await photoRes.arrayBuffer());
    if (!buffer.length) return undefined;

    const lowerPath = String(filePath).toLowerCase();
    const mimeType = lowerPath.endsWith('.png')
      ? 'image/png'
      : lowerPath.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return undefined;
  }
}


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const page = parsePagination(request.nextUrl.searchParams)
    if (!page.success) {
      return NextResponse.json({ success: false, error: 'Invalid pagination' }, { status: 400 })
    }
    const sort = parseSort(
      request.nextUrl.searchParams,
      ['createdAt', 'platformId', 'isActive', 'accountName'] as const,
      'createdAt'
    )
    if (!sort.success) {
      return NextResponse.json({ success: false, error: 'Invalid sort' }, { status: 400 })
    }
    const search = page.data.search
    const platformId = request.nextUrl.searchParams.get('platformId') || undefined
    const isActiveParam = request.nextUrl.searchParams.get('isActive')
    const isActive = isActiveParam === null ? undefined : isActiveParam === 'true'

    const result = await db.getUserAccountsPaged({
      userId: user.id,
      limit: page.data.limit,
      offset: page.data.offset,
      search,
      platformId,
      isActive,
      sortBy: sort.data.sortBy,
      sortDir: sort.data.sortDir,
    })
    
    return NextResponse.json({
      success: true,
      accounts: result.accounts,
      total: result.total,
      nextOffset: page.data.offset + result.accounts.length,
      hasMore: page.data.offset + result.accounts.length < result.total,
    })
  } catch (error) {
    console.error('[API] Error fetching accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const limiter = rateLimit(`accounts:post:${getClientKey(request)}`, 30, 60_000)
    if (!limiter.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
    }
    const body = await request.json() as Partial<PlatformAccount>
    const user = await getAuthUser()
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const schema = z.object({
      platformId: z.string().min(1),
      accountName: z.string().min(1).optional(),
      accountUsername: z.string().optional(),
      accountId: z.string().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      credentials: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 })
    }
    const safe = parsed.data

    if (safe.platformId !== 'telegram' && !safe.accountName) {
      return NextResponse.json({ success: false, error: 'Account name is required' }, { status: 400 })
    }

    const telegramBotToken =
      safe.platformId === 'telegram' ? String(safe.accessToken || '').trim() : undefined

    if (safe.platformId === 'telegram' && !telegramBotToken) {
      return NextResponse.json({ success: false, error: 'Telegram bot token is required' }, { status: 400 })
    }

    if (safe.platformId === 'twitter') {
      const token = (safe.accessToken || '').trim()
      if (!token || token === 'manual' || token.startsWith('oauth_')) {
        return NextResponse.json(
          { success: false, error: 'Twitter requires a valid user access token. Connect with OAuth to get media.write scope.' },
          { status: 400 }
        )
      }
    }

    const userAccounts = await db.getUserAccounts(user.id)
    const findExistingAccount = (resolvedAccountId?: string) =>
      userAccounts.find((a) => {
        if (a.platformId !== safe.platformId) return false
        if (safe.platformId === 'telegram' && telegramBotToken && String(a.accessToken || '').trim() === telegramBotToken) {
          return true
        }
        const candidateAccountId = resolvedAccountId || safe.accountId
        return Boolean(candidateAccountId) && a.accountId === candidateAccountId
      })

    const existingNonTelegram = safe.platformId === 'telegram' ? undefined : findExistingAccount()
    if (existingNonTelegram) {
      return NextResponse.json({ success: true, account: existingNonTelegram }, { status: 200 })
    }

    let accountName = safe.accountName ?? '';
    let accountUsername = safe.accountUsername ?? safe.accountName ?? '';
    let accountId = safe.accountId ?? `${safe.platformId}_${Date.now()}`;

    if (safe.platformId === 'telegram' && telegramBotToken) {
      try {
        const telegramApiBaseUrl = getTelegramApiBaseUrl();
        const res = await fetch(buildTelegramBotMethodUrl(telegramBotToken, 'getMe', telegramApiBaseUrl));
        const data = await res.json();
        if (!res.ok || !data?.ok || !data?.result) {
          return NextResponse.json({ success: false, error: 'Invalid Telegram bot token' }, { status: 400 })
        }
        const bot = data.result;
        accountName = bot.first_name || 'Telegram Bot';
        accountUsername = bot.username || bot.first_name || 'telegram_bot';
        accountId = String(bot.id || accountId);
        const profileImageUrl = await fetchTelegramBotProfileImage(telegramBotToken, bot.id);
        const existingTelegram = findExistingAccount(accountId)
        if (existingTelegram) {
          const currentCredentials = (existingTelegram.credentials as Record<string, any>) || {}
          const incomingCredentials = (safe.credentials as Record<string, any>) || {}
          const mergedCredentials: Record<string, any> = {
            ...currentCredentials,
            ...incomingCredentials,
            isBot: Boolean(bot.is_bot ?? true),
            profileImageUrl,
            accountInfo: {
              id: String(bot.id || accountId),
              username: bot.username || accountUsername,
              name: bot.first_name || accountName,
              isBot: Boolean(bot.is_bot ?? true),
              profileImageUrl,
            },
          }

          if (typeof incomingCredentials.chatId !== 'undefined') {
            mergedCredentials.chatId = incomingCredentials.chatId
          }

          const updated = await db.updateAccount(existingTelegram.id, {
            accountName,
            accountUsername,
            accountId,
            accessToken: telegramBotToken,
            refreshToken: safe.refreshToken ?? existingTelegram.refreshToken,
            credentials: mergedCredentials,
            isActive: safe.isActive ?? true,
          })

          return NextResponse.json({ success: true, account: updated ?? existingTelegram }, { status: 200 })
        }

        const webhookSecret = randomUUID();
        const baseUrl = (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
        const webhookUrl = `${baseUrl}/api/telegram/webhook/${telegramBotToken}`;

        const webhookRes = await fetch(buildTelegramBotMethodUrl(telegramBotToken, 'setWebhook', telegramApiBaseUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Allow Telegram to deliver album items in parallel webhook requests.
          // Can be overridden via env. Telegram Bot API range is 1..100.
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: webhookSecret,
            max_connections: Math.min(
              100,
              Math.max(1, Number(process.env.TELEGRAM_WEBHOOK_MAX_CONNECTIONS || '40'))
            ),
          }),
        });

        const webhookData = await webhookRes.json().catch(() => null);
        if (!webhookRes.ok || !webhookData?.ok) {
          const retryAfter = Number(webhookData?.parameters?.retry_after)
          const detail =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? `Too Many Requests. Retry after ${retryAfter} second(s)`
              : (typeof webhookData?.description === 'string' && webhookData.description.trim()) ||
                (typeof webhookData?.error_code !== 'undefined'
                  ? `Telegram error code ${webhookData.error_code}`
                  : '');
          return NextResponse.json(
            {
              success: false,
              error: detail
                ? `Failed to register Telegram webhook: ${detail}`
                : 'Failed to register Telegram webhook',
            },
            { status: 400 }
          );
        }

        safe.credentials = {
          ...(safe.credentials ?? {}),
          webhookSecret,
          chatId: (safe.credentials as any)?.chatId,
          isBot: Boolean(bot.is_bot ?? true),
          profileImageUrl,
          accountInfo: {
            id: String(bot.id || accountId),
            username: bot.username || accountUsername,
            name: bot.first_name || accountName,
            isBot: Boolean(bot.is_bot ?? true),
            profileImageUrl,
          },
        };
      } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to verify Telegram bot token' }, { status: 400 })
      }
    }

    // Create account
    const account = await db.createAccount({
      id: randomUUID(),
      userId: user.id,
      platformId: safe.platformId,
      accountName,
      accountUsername,
      accountId,
      accessToken: safe.platformId === 'telegram' ? telegramBotToken ?? 'manual' : safe.accessToken ?? 'manual',
      refreshToken: safe.refreshToken,
      credentials: safe.credentials ?? {},
      isActive: safe.isActive ?? true,
    })

    return NextResponse.json({ success: true, account }, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating account:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
