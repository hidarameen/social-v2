import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

export const runtime = 'nodejs';


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idCheck = z.string().min(1).safeParse(id);
    if (!idCheck.success) {
      return NextResponse.json({ success: false, error: 'Invalid account id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const current = await db.getAccount(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const schema = z.object({
      platformId: z.string().min(1).optional(),
      accountName: z.string().min(1).optional(),
      accountUsername: z.string().optional(),
      accountId: z.string().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      credentials: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const body = parsed.data;
    const updated = await db.updateAccount(id, body);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, account: updated });
  } catch (error) {
    console.error('[API] Error updating account:', error);
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: 'Invalid account id' }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const current = await db.getAccount(id);
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    const deleted = await db.deleteAccount(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting account:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 500 });
  }
}
