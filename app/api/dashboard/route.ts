import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { parsePagination } from '@/lib/validation';

export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const page = parsePagination(request.nextUrl.searchParams);
    if (!page.success) {
      return NextResponse.json({ success: false, error: 'Invalid pagination' }, { status: 400 });
    }

    const [tasks, accounts] = await Promise.all([
      db.getUserTasksPaged({
        userId: user.id,
        limit: page.data.limit,
        offset: 0,
        sortBy: 'createdAt',
        sortDir: 'desc',
      }),
      db.getUserAccountsPaged({
        userId: user.id,
        limit: page.data.limit,
        offset: 0,
        sortBy: 'createdAt',
        sortDir: 'desc',
      }),
    ]);

    const activeTasks = tasks.tasks.filter(t => t.status === 'active');
    const executions = (
      await Promise.all(tasks.tasks.map(t => db.getTaskExecutions(t.id)))
    ).flat();

    const recentTasks = tasks.tasks.slice(0, 5);
    const recentExecutions = executions
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      stats: {
        totalTasks: tasks.total,
        totalAccounts: accounts.total,
        activeTasksCount: activeTasks.length,
        totalExecutions: executions.length,
      },
      recentTasks,
      recentExecutions,
    });
  } catch (error) {
    console.error('[API] Error fetching dashboard:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
