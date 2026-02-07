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
    const updated = await db.updateTask(id, {
      ...body,
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
