import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { createManualPublishTemplate, listManualPublishTemplates } from '@/lib/manual-publish/templates';

export const runtime = 'nodejs';

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  message: z.string().max(10000).default(''),
  mediaUrl: z.string().max(2000).optional(),
  mediaType: z.enum(['image', 'video', 'link']).optional(),
  defaultAccountIds: z.array(z.string().min(1)).default([]),
  platformOverrides: z.record(z.any()).optional(),
});

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await listManualPublishTemplates(user.id);
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('[API] Publish templates GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = createTemplateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid template payload' }, { status: 400 });
    }

    const template = await createManualPublishTemplate(user.id, {
      name: parsed.data.name,
      description: parsed.data.description,
      message: parsed.data.message,
      mediaUrl: parsed.data.mediaUrl,
      mediaType: parsed.data.mediaType,
      defaultAccountIds: parsed.data.defaultAccountIds,
      platformOverrides: parsed.data.platformOverrides as any,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('[API] Publish templates POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create template' }, { status: 500 });
  }
}
