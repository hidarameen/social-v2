import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import {
  deleteManualPublishTemplate,
  updateManualPublishTemplate,
} from '@/lib/manual-publish/templates';

export const runtime = 'nodejs';

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  message: z.string().max(10000).optional(),
  mediaUrl: z.string().max(2000).optional(),
  mediaType: z.enum(['image', 'video', 'link']).optional(),
  defaultAccountIds: z.array(z.string().min(1)).optional(),
  platformOverrides: z.record(z.any()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing template id' }, { status: 400 });
    }

    const parsed = updateTemplateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid template payload' }, { status: 400 });
    }

    const template = await updateManualPublishTemplate(user.id, id, parsed.data as any);
    if (!template) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('[API] Publish template PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing template id' }, { status: 400 });
    }

    const removed = await deleteManualPublishTemplate(user.id, id);
    if (!removed) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Publish template DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete template' }, { status: 500 });
  }
}
