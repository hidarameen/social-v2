import { NextRequest, NextResponse } from 'next/server';
import { db, type Task } from '@/lib/db';
import { randomUUID } from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';
import { getClientKey, rateLimit } from '@/lib/rate-limit';
import { parsePagination, parseSort } from '@/lib/validation';
import { ensureTwitterPollingStarted } from '@/lib/services/twitter-poller';

export async function GET(request: NextRequest) {
  try {
    ensureTwitterPollingStarted();
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
    ensureTwitterPollingStarted();
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
    const body = parsed.data as Partial<Task>;

    const normalizeIds = (ids: string[] = []) => [...ids].sort().join('|');
    const existingTasks = await db.getUserTasks(user.id);
    const incomingSource = normalizeIds(body.sourceAccounts ?? []);
    const incomingTarget = normalizeIds(body.targetAccounts ?? []);
    const duplicate = existingTasks.find(
      t =>
        t.name === body.name &&
        normalizeIds(t.sourceAccounts) === incomingSource &&
        normalizeIds(t.targetAccounts) === incomingTarget
    );
    if (duplicate) {
      return NextResponse.json({ success: true, task: duplicate, duplicate: true }, { status: 200 });
    }

    const task = await db.createTask({
      id: randomUUID(),
      userId: user.id,
      name: body.name,
      description: body.description ?? '',
      sourceAccounts: body.sourceAccounts,
      targetAccounts: body.targetAccounts,
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
