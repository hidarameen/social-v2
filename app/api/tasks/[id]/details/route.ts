import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { taskProcessor } from '@/lib/services/task-processor';
import { advancedProcessingService } from '@/lib/services/advanced-processing';
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

    const [stats, executions, errorAnalysis, failurePrediction, performanceReport] = await Promise.all([
      taskProcessor.getExecutionStats(task.id),
      db.getTaskExecutions(task.id),
      advancedProcessingService.analyzeErrors(task),
      advancedProcessingService.predictFailure(task),
      advancedProcessingService.generatePerformanceReport(task),
    ]);

    return NextResponse.json({
      success: true,
      task,
      stats,
      executions,
      errorAnalysis,
      failurePrediction,
      performanceReport,
    });
  } catch (error) {
    console.error('[API] Error fetching task details:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch task details' }, { status: 500 });
  }
}
