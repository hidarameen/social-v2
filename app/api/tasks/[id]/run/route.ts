import { NextRequest, NextResponse } from 'next/server';
import { taskProcessor } from '@/lib/services/task-processor';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getClientKey, rateLimit } from '@/lib/rate-limit';
import { executionQueue } from '@/lib/services/execution-queue';
import { z } from 'zod';

export const runtime = 'nodejs';


export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid task id' }, { status: 400 });
    }
    const limiter = rateLimit(`tasks:run:${getClientKey(_request)}`, 10, 60_000);
    if (!limiter.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const task = await db.getTask(id);
    if (!task || task.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const executions = await executionQueue.enqueue({
      label: 'api:task-run',
      userId: user.id,
      taskId: task.id,
      dedupeKey: `api:task-run:${user.id}:${task.id}`,
      run: async () => taskProcessor.processTask(id),
    });
    return NextResponse.json({ success: true, executions });
  } catch (error) {
    console.error('[API] Error running task:', error);
    return NextResponse.json({ success: false, error: 'Failed to run task' }, { status: 500 });
  }
}
