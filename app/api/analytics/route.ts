import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { parsePagination, parseSort } from '@/lib/validation';

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
    const sort = parseSort(
      request.nextUrl.searchParams,
      ['taskName', 'successRate', 'totalExecutions', 'failed'] as const,
      'successRate'
    );
    if (!sort.success) {
      return NextResponse.json({ success: false, error: 'Invalid sort' }, { status: 400 });
    }

    const [totals, taskStats] = await Promise.all([
      db.getExecutionTotalsForUser(user.id),
      db.getTaskStatsForUser({
        userId: user.id,
        limit: page.data.limit,
        offset: page.data.offset,
        search: page.data.search,
        sortBy: sort.data.sortBy,
        sortDir: sort.data.sortDir,
      }),
    ]);

    return NextResponse.json({
      success: true,
      totals: {
        tasks: taskStats.total,
        executions: totals.total,
        successfulExecutions: totals.successful,
        failedExecutions: totals.failed,
      },
      taskStats: taskStats.stats,
      nextOffset: page.data.offset + taskStats.stats.length,
      hasMore: page.data.offset + taskStats.stats.length < taskStats.total,
    });
  } catch (error) {
    console.error('[API] Error fetching analytics:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
