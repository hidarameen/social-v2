import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getFileExtension(fileName: string, mimeType: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName) return fromName;
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/quicktime') return '.mov';
  if (mimeType === 'video/webm') return '.webm';
  return '';
}

function resolveBaseUrl(request: NextRequest): string {
  return (
    trimString(process.env.NEXT_PUBLIC_APP_URL) ||
    trimString(process.env.APP_URL) ||
    trimString(process.env.NEXTAUTH_URL) ||
    request.nextUrl.origin
  ).replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file received.' }, { status: 400 });
    }

    const mimeType = trimString(file.type).toLowerCase();
    if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
      return NextResponse.json(
        { success: false, error: 'Only image/video uploads are supported.' },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: `File is too large. Max size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      );
    }

    const dateFolder = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeOriginalName = sanitizeFileName(file.name || 'upload');
    const extension = getFileExtension(safeOriginalName, mimeType);
    const finalName = `${randomUUID()}-${safeOriginalName.replace(/\.[^/.]+$/, '')}${extension}`;
    const relativePublicPath = `/uploads/manual/${dateFolder}/${finalName}`;
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'manual', dateFolder, finalName);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absolutePath, Buffer.from(bytes));

    const baseUrl = resolveBaseUrl(request);
    const url = `${baseUrl}${relativePublicPath}`;

    return NextResponse.json({
      success: true,
      url,
      mimeType,
      size: file.size,
      fileName: finalName,
    });
  } catch (error) {
    console.error('[API] Manual publish upload error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload media.' }, { status: 500 });
  }
}
