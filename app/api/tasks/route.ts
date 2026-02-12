import { NextRequest, NextResponse } from 'next/server';
import { db, type Task } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';
import { getClientKey, rateLimit } from '@/lib/rate-limit';
import { parsePagination, parseSort } from '@/lib/validation';
import { ensureTwitterPollingStarted } from '@/lib/services/twitter-poller';
import { ensureTwitterStreamStarted } from '@/lib/services/twitter-stream';
import { ensureSchedulerStarted } from '@/lib/services/task-scheduler';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await ensureTwitterPollingStarted();
    ensureTwitterStreamStarted();
    ensureSchedulerStarted();
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const page = parsePagination(request.nextUrl.searchParams);
    if (!page.success) {
      return NextResponse.json({ success: false, error: 'Invalid pagination' }, { status: 400 });
    }
    const sort = parseSort(request.nextUrl.searchParams, ['createdAt', 'status', 'name'] as const, 'createdAt');
    if (!sort.success) {
      return NextResponse.json({ success: false, error: 'Invalid sort' }, { status: 400 });
    }
    const status = request.nextUrl.searchParams.get('status') || undefined;

    const result = await db.getUserTasksPaged({
      userId: user.id,
      limit: page.data.limit,
      offset: page.data.offset,
      search: page.data.search,
      status,
      sortBy: sort.data.sortBy,
      sortDir: sort.data.sortDir,
    });

    return NextResponse.json({
      success: true,
      tasks: result.tasks,
      total: result.total,
      nextOffset: page.data.offset + result.tasks.length,
      hasMore: page.data.offset + result.tasks.length < result.total,
    });
  } catch (error) {
    console.error('[API] Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const limiter = rateLimit(`tasks:post:${getClientKey(request)}`, 30, 60_000);
    if (!limiter.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
    await ensureTwitterPollingStarted();
    ensureTwitterStreamStarted();
    ensureSchedulerStarted();
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      sourceAccounts: z.array(z.string()).min(1),
      targetAccounts: z.array(z.string()).min(1),
      contentType: z.enum(['text', 'image', 'video', 'link']).optional(),
      status: z.enum(['active', 'paused', 'completed', 'error']).optional(),
      executionType: z.enum(['immediate', 'scheduled', 'recurring']).optional(),
      scheduleTime: z.union([z.string(), z.date()]).optional(),
      recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
      recurringDays: z.array(z.number()).optional(),
      filters: z.any().optional(),
      transformations: z.any().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const body = parsed.data;

    const uniqueIds = (ids: string[] = []) => [...new Set(ids.filter(Boolean))];
    const sourceAccounts = uniqueIds(body.sourceAccounts ?? []);
    const targetAccounts = uniqueIds(body.targetAccounts ?? []);
    if (sourceAccounts.length === 0 || targetAccounts.length === 0) {
      return NextResponse.json({ success: false, error: 'Source and target accounts are required' }, { status: 400 });
    }

    const overlappingAccounts = sourceAccounts.filter(id => targetAccounts.includes(id));
    if (overlappingAccounts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A single account cannot be both source and target in the same task' },
        { status: 400 }
      );
    }

    const userAccounts = await db.getUserAccounts(user.id);
    const userAccountIds = new Set(userAccounts.map(a => a.id));
    const unknownAccountId = [...sourceAccounts, ...targetAccounts].find(id => !userAccountIds.has(id));
    if (unknownAccountId) {
      return NextResponse.json({ success: false, error: 'One or more selected accounts are invalid' }, { status: 400 });
    }

    const accountById = new Map(userAccounts.map(a => [a.id, a]));
    const sourcePlatforms = new Set(sourceAccounts.map(id => accountById.get(id)?.platformId).filter(Boolean));
    const targetPlatforms = new Set(targetAccounts.map(id => accountById.get(id)?.platformId).filter(Boolean));
    const hasTelegramBothSides = sourcePlatforms.has('telegram') && targetPlatforms.has('telegram');
    const hasTwitterBothSides = sourcePlatforms.has('twitter') && targetPlatforms.has('twitter');
    if (hasTelegramBothSides && hasTwitterBothSides) {
      return NextResponse.json(
        { success: false, error: 'This task configuration can create a Telegram/Twitter loop. Split it into one-way tasks.' },
        { status: 400 }
      );
    }

    const normalizeIds = (ids: string[] = []) => [...ids].sort().join('|');
    const existingTasks = await db.getUserTasks(user.id);
    const incomingSource = normalizeIds(sourceAccounts);
    const incomingTarget = normalizeIds(targetAccounts);
    const duplicate = existingTasks.find(
      t =>
        t.name === body.name &&
        normalizeIds(t.sourceAccounts) === incomingSource &&
        normalizeIds(t.targetAccounts) === incomingTarget
    );
    if (duplicate) {
      return NextResponse.json({ success: true, task: duplicate, duplicate: true }, { status: 200 });
    }

    const youtubeActions = (body.transformations as any)?.youtubeActions;
    if (youtubeActions?.uploadVideoToPlaylist && !String(youtubeActions?.playlistId || '').trim()) {
      return NextResponse.json(
        { success: false, error: 'YouTube playlist action requires selecting a playlist' },
        { status: 400 }
      );
    }
    const publishAt = (body.transformations as any)?.youtubeVideo?.publishAt;
    if (publishAt && Number.isNaN(new Date(String(publishAt)).getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid YouTube publish date/time' },
        { status: 400 }
      );
    }

    const task = await db.createTask({
      id: randomUUID(),
      userId: user.id,
      name: body.name,
      description: body.description ?? '',
      sourceAccounts,
      targetAccounts,
      contentType: body.contentType ?? 'text',
      status: body.status ?? 'active',
      executionType: body.executionType ?? 'immediate',
      scheduleTime: body.scheduleTime ? new Date(body.scheduleTime) : undefined,
      recurringPattern: body.recurringPattern ?? undefined,
      recurringDays: body.recurringDays ?? undefined,
      filters: body.filters ?? undefined,
      transformations: body.transformations ?? undefined,
      executionCount: 0,
      failureCount: 0,
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
