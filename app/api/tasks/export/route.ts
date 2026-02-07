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
    const result = await db.getUserTasksPaged({
      userId: user.id,
      limit,
      offset: 0,
      sortBy: 'createdAt',
      sortDir: 'desc',
    });

    const header = ['name', 'status', 'executionType', 'createdAt', 'sourceCount', 'targetCount'];
    const rows = result.tasks.map(t => [
      t.name,
      t.status,
      t.executionType,
      t.createdAt.toISOString(),
      t.sourceAccounts.length,
      t.targetAccounts.length,
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tasks.csv"',
      },
    });
  } catch (error) {
    console.error('[API] Export tasks error:', error);
    return NextResponse.json({ success: false, error: 'Failed to export tasks' }, { status: 500 });
  }
}
