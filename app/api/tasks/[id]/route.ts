import { NextRequest, NextResponse } from 'next/server';
import { db, type Task } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const task = await db.getTask(id);
    if (!task || task.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('[API] Error fetching task:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch task' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      sourceAccounts: z.array(z.string()).min(1).optional(),
      targetAccounts: z.array(z.string()).min(1).optional(),
      contentType: z.enum(['text', 'image', 'video', 'link']).optional(),
      status: z.enum(['active', 'paused', 'completed', 'error']).optional(),
      executionType: z.enum(['immediate', 'scheduled', 'recurring']).optional(),
      scheduleTime: z.union([z.string(), z.date()]).optional(),
      recurringPattern: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
      recurringDays: z.array(z.number()).optional(),
      filters: z.any().optional(),
      transformations: z.any().optional(),
      lastExecuted: z.union([z.string(), z.date()]).optional(),
      executionCount: z.number().int().nonnegative().optional(),
      failureCount: z.number().int().nonnegative().optional(),
      lastError: z.string().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const body = parsed.data as Partial<Task>;
    const current = await db.getTask(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const uniqueIds = (ids: string[] = []) => [...new Set(ids.filter(Boolean))];
    const nextSourceAccounts = body.sourceAccounts ? uniqueIds(body.sourceAccounts) : current.sourceAccounts;
    const nextTargetAccounts = body.targetAccounts ? uniqueIds(body.targetAccounts) : current.targetAccounts;
    if (nextSourceAccounts.length === 0 || nextTargetAccounts.length === 0) {
      return NextResponse.json({ success: false, error: 'Source and target accounts are required' }, { status: 400 });
    }

    const overlappingAccounts = nextSourceAccounts.filter(id => nextTargetAccounts.includes(id));
    if (overlappingAccounts.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A single account cannot be both source and target in the same task' },
        { status: 400 }
      );
    }

    const userAccounts = await db.getUserAccounts(user.id);
    const userAccountIds = new Set(userAccounts.map(a => a.id));
    const unknownAccountId = [...nextSourceAccounts, ...nextTargetAccounts].find(id => !userAccountIds.has(id));
    if (unknownAccountId) {
      return NextResponse.json({ success: false, error: 'One or more selected accounts are invalid' }, { status: 400 });
    }

    const accountById = new Map(userAccounts.map(a => [a.id, a]));
    const sourcePlatforms = new Set(nextSourceAccounts.map(id => accountById.get(id)?.platformId).filter(Boolean));
    const targetPlatforms = new Set(nextTargetAccounts.map(id => accountById.get(id)?.platformId).filter(Boolean));
    const hasTelegramBothSides = sourcePlatforms.has('telegram') && targetPlatforms.has('telegram');
    const hasTwitterBothSides = sourcePlatforms.has('twitter') && targetPlatforms.has('twitter');
    if (hasTelegramBothSides && hasTwitterBothSides) {
      return NextResponse.json(
        { success: false, error: 'This task configuration can create a Telegram/Twitter loop. Split it into one-way tasks.' },
        { status: 400 }
      );
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

    const updated = await db.updateTask(id, {
      ...body,
      sourceAccounts: nextSourceAccounts,
      targetAccounts: nextTargetAccounts,
      scheduleTime: body.scheduleTime ? new Date(body.scheduleTime) : body.scheduleTime,
      lastExecuted: body.lastExecuted ? new Date(body.lastExecuted) : body.lastExecuted,
    });
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error('[API] Error updating task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const current = await db.getTask(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    const deleted = await db.deleteTask(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting task:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
