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
    const limit = Math.min(page.data.limit, 5000);
    const stats = await db.getTaskStatsForUser({
      userId: user.id,
      limit,
      offset: 0,
      sortBy: 'successRate',
      sortDir: 'desc',
    });

    const header = ['taskName', 'totalExecutions', 'successful', 'failed', 'successRate'];
    const rows = stats.stats.map(s => [
      s.taskName,
      s.totalExecutions,
      s.successful,
      s.failed,
      s.successRate,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="analytics.csv"',
      },
    });
  } catch (error) {
    console.error('[API] Export analytics error:', error);
    return NextResponse.json({ success: false, error: 'Failed to export analytics' }, { status: 500 });
  }
}
