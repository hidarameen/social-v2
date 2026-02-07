import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getClientKey, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';


export async function POST(request: NextRequest) {
  try {
    const limiter = rateLimit(`auth:register:${getClientKey(request)}`, 10, 60_000);
    if (!limiter.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const name = parsed.data.name.trim();
    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const user = await db.createUser({
      id: randomUUID(),
      name,
      email,
      passwordHash,
    });

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (error) {
    console.error('[API] Register error:', error);
    return NextResponse.json({ success: false, error: 'Failed to register' }, { status: 500 });
  }
}
