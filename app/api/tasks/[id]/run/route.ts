import { NextRequest, NextResponse } from 'next/server';
import { taskProcessor } from '@/lib/services/task-processor';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getClientKey, rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';


export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const idCheck = z.string().min(1).safeParse(params.id);
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
    const task = await db.getTask(params.id);
    if (!task || task.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const executions = await taskProcessor.processTask(params.id);
    return NextResponse.json({ success: true, executions });
  } catch (error) {
    console.error('[API] Error running task:', error);
    return NextResponse.json({ success: false, error: 'Failed to run task' }, { status: 500 });
  }
}
