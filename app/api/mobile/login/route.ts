import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { z } from 'zod';

import { db } from '@/lib/db';
import { isEmailVerificationEnabled } from '@/lib/auth/email-verification';
import { getClientKey, rateLimit } from '@/lib/rate-limit';
import { issueMobileAccessToken } from '@/lib/mobile-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const limiter = rateLimit(`mobile:login:${getClientKey(request)}`, 20, 60_000);
    if (!limiter.ok) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const schema = z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(1).max(256),
    });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password;

    const user = await db.getUserByEmailWithPassword(email);
    if (!user?.passwordHash) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (isEmailVerificationEnabled() && !user.emailVerifiedAt) {
      return NextResponse.json(
        { success: false, error: 'Email not verified yet' },
        { status: 403 }
      );
    }

    const accessToken = issueMobileAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('[API] mobile login error:', error);
    return NextResponse.json({ success: false, error: 'Failed to sign in' }, { status: 500 });
  }
}
