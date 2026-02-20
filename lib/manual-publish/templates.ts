import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import type { PlatformId } from '@/lib/platforms/types';
import type {
  ManualPlatformOverride,
  ManualPublishMediaType,
  ManualPublishTemplate,
} from '@/lib/manual-publish/types';

const TEMPLATE_CREDENTIAL_PLATFORM_ID = 'manual_publish_templates';

const PLATFORM_IDS: PlatformId[] = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'telegram',
  'linkedin',
  'pinterest',
  'google_business',
  'threads',
  'snapchat',
  'whatsapp',
];

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMediaType(value: unknown): ManualPublishMediaType | undefined {
  return value === 'image' || value === 'video' || value === 'link' ? value : undefined;
}

function sanitizeOverride(value: unknown): ManualPlatformOverride | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const message = trimString(record.message);
  const mediaUrl = trimString(record.mediaUrl);
  const mediaType = sanitizeMediaType(record.mediaType);

  if (!message && !mediaUrl && !mediaType) return undefined;

  return {
    message: message || undefined,
    mediaUrl: mediaUrl || undefined,
    mediaType,
  };
}

function sanitizeTemplate(raw: unknown): ManualPublishTemplate | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  const id = trimString(value.id);
  const name = trimString(value.name);
  const message = String(value.message || '');
  const createdAt = trimString(value.createdAt) || new Date().toISOString();
  const updatedAt = trimString(value.updatedAt) || createdAt;
  if (!id || !name) return undefined;

  const defaultAccountIds = Array.isArray(value.defaultAccountIds)
    ? [...new Set(value.defaultAccountIds.map((item) => trimString(item)).filter(Boolean))]
    : [];

  const platformOverrides: Partial<Record<PlatformId, ManualPlatformOverride>> = {};
  const rawOverrides =
    value.platformOverrides && typeof value.platformOverrides === 'object'
      ? (value.platformOverrides as Record<string, unknown>)
      : {};

  for (const platformId of PLATFORM_IDS) {
    const parsed = sanitizeOverride(rawOverrides[platformId]);
    if (parsed) {
      platformOverrides[platformId] = parsed;
    }
  }

  return {
    id,
    name,
    description: trimString(value.description) || undefined,
    message,
    mediaUrl: trimString(value.mediaUrl) || undefined,
    mediaType: sanitizeMediaType(value.mediaType),
    defaultAccountIds,
    platformOverrides,
    createdAt,
    updatedAt,
  };
}

async function readTemplatesRaw(userId: string): Promise<ManualPublishTemplate[]> {
  const record = await db.getUserPlatformCredential(userId, TEMPLATE_CREDENTIAL_PLATFORM_ID);
  const raw = record?.credentials && typeof record.credentials === 'object' ? record.credentials : {};
  const maybeTemplates = (raw as Record<string, unknown>).templates;
  const incoming: unknown[] = Array.isArray(maybeTemplates) ? maybeTemplates : [];
  return incoming
    .map((item: unknown) => sanitizeTemplate(item))
    .filter((item: ManualPublishTemplate | undefined): item is ManualPublishTemplate => Boolean(item))
    .sort((a: ManualPublishTemplate, b: ManualPublishTemplate) => b.updatedAt.localeCompare(a.updatedAt));
}

async function writeTemplatesRaw(userId: string, templates: ManualPublishTemplate[]) {
  await db.upsertUserPlatformCredential({
    userId,
    platformId: TEMPLATE_CREDENTIAL_PLATFORM_ID,
    credentials: {
      templates,
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function listManualPublishTemplates(userId: string): Promise<ManualPublishTemplate[]> {
  return readTemplatesRaw(userId);
}

export async function createManualPublishTemplate(
  userId: string,
  input: Omit<ManualPublishTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ManualPublishTemplate> {
  const now = new Date().toISOString();
  const template: ManualPublishTemplate = sanitizeTemplate({
    ...input,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }) as ManualPublishTemplate;

  const templates = await readTemplatesRaw(userId);
  templates.unshift(template);
  await writeTemplatesRaw(userId, templates);
  return template;
}

export async function updateManualPublishTemplate(
  userId: string,
  templateId: string,
  patch: Partial<Omit<ManualPublishTemplate, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ManualPublishTemplate | null> {
  const templates = await readTemplatesRaw(userId);
  const index = templates.findIndex((item) => item.id === templateId);
  if (index < 0) return null;

  const existing = templates[index];
  const candidate = sanitizeTemplate({
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  });
  if (!candidate) return null;

  templates[index] = candidate;
  await writeTemplatesRaw(userId, templates);
  return candidate;
}

export async function deleteManualPublishTemplate(userId: string, templateId: string): Promise<boolean> {
  const templates = await readTemplatesRaw(userId);
  const filtered = templates.filter((item) => item.id !== templateId);
  if (filtered.length === templates.length) return false;
  await writeTemplatesRaw(userId, filtered);
  return true;
}
