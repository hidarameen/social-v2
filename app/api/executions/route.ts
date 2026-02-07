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
    const sort = parseSort(request.nextUrl.searchParams, ['executedAt', 'status', 'taskName'] as const, 'executedAt');
    if (!sort.success) {
      return NextResponse.json({ success: false, error: 'Invalid sort' }, { status: 400 });
    }
    const status = request.nextUrl.searchParams.get('status') || undefined;

    const result = await db.getExecutionsForUserPaged({
      userId: user.id,
      limit: page.data.limit,
      offset: page.data.offset,
      status,
      search: page.data.search,
      sortBy: sort.data.sortBy,
      sortDir: sort.data.sortDir,
    });

    return NextResponse.json({
      success: true,
      executions: result.executions,
      total: result.total,
      nextOffset: page.data.offset + result.executions.length,
      hasMore: page.data.offset + result.executions.length < result.total,
    });
  } catch (error) {
    console.error('[API] Error fetching executions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch executions' }, { status: 500 });
  }
}
