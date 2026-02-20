import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { db, type PlatformAccount, type TaskExecution } from '@/lib/db';
import type { PlatformId } from '@/lib/platforms/types';
import { getPlatformHandlerForUser } from '@/lib/platforms/handlers';
import {
  getPlatformApiProviderForUser,
  type PlatformApiProvider,
} from '@/lib/platforms/provider';
import {
  createBufferPublishTokenForAccount,
  getBufferUserSettings,
} from '@/lib/buffer-user-settings';
import { validateManualPublishForPlatform } from '@/lib/manual-publish/constraints';
import type {
  ManualPlatformOverride,
  ManualPlatformTemplateSettings,
  ManualPublishExecutionResult,
  ManualPublishMediaType,
} from '@/lib/manual-publish/types';
import { taskProcessor } from '@/lib/services/task-processor';
import { executionQueue } from '@/lib/services/execution-queue';

export const runtime = 'nodejs';

const MANAGED_PLATFORM_IDS = new Set<PlatformId>([
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
]);

const MANUAL_SOURCE_ACCOUNT_PREFIX = 'manual-source:';

const publishSchema = z.object({
  message: z.string().max(10000).default(''),
  mediaUrl: z.string().max(2000).optional(),
  mediaType: z.enum(['image', 'video', 'link']).optional(),
  accountIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(['now', 'schedule']).default('now'),
  scheduledAt: z.string().optional(),
  platformOverrides: z.record(z.any()).optional(),
  platformSettings: z.record(z.any()).optional(),
  dryRun: z.boolean().optional(),
  checkConnectivity: z.boolean().optional(),
});

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asManagedPlatformId(value: string): PlatformId | null {
  return MANAGED_PLATFORM_IDS.has(value as PlatformId) ? (value as PlatformId) : null;
}

function asMediaType(value: unknown): ManualPublishMediaType | undefined {
  return value === 'image' || value === 'video' || value === 'link' ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function extractPlatformOverride(
  rawOverrides: Record<string, unknown>,
  platformId: PlatformId
): ManualPlatformOverride {
  const candidate =
    rawOverrides && typeof rawOverrides === 'object'
      ? (rawOverrides[platformId] as Record<string, unknown>)
      : undefined;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  return {
    message: trimString(candidate.message) || undefined,
    mediaUrl: trimString(candidate.mediaUrl) || undefined,
    mediaType: asMediaType(candidate.mediaType),
  };
}

function normalizePlatformOverrides(
  rawOverrides: Record<string, unknown>
): Record<string, { message?: string; mediaUrl?: string; mediaType?: ManualPublishMediaType }> {
  const normalized: Record<
    string,
    { message?: string; mediaUrl?: string; mediaType?: ManualPublishMediaType }
  > = {};
  for (const platformId of MANAGED_PLATFORM_IDS) {
    const override = extractPlatformOverride(rawOverrides, platformId);
    if (!override.message && !override.mediaUrl && !override.mediaType) continue;
    normalized[platformId] = override;
  }
  return normalized;
}

function extractPlatformSettings(
  rawSettings: Record<string, unknown>,
  platformId: PlatformId
): ManualPlatformTemplateSettings {
  const candidate =
    rawSettings && typeof rawSettings === 'object'
      ? (rawSettings[platformId] as Record<string, unknown>)
      : undefined;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};

  const defaultHashtags = Array.isArray(candidate.defaultHashtags)
    ? candidate.defaultHashtags
        .map((item) => trimString(item).replace(/^#+/, ''))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return {
    enabled:
      typeof candidate.enabled === 'boolean'
        ? candidate.enabled
        : candidate.enabled === '1'
          ? true
          : candidate.enabled === '0'
            ? false
            : undefined,
    notes: trimString(candidate.notes) || undefined,
    defaultHashtags: defaultHashtags.length > 0 ? defaultHashtags : undefined,
  };
}

function normalizePlatformSettings(
  rawSettings: Record<string, unknown>
): Record<string, ManualPlatformTemplateSettings> {
  const normalized: Record<string, ManualPlatformTemplateSettings> = {};
  for (const platformId of MANAGED_PLATFORM_IDS) {
    const settings = extractPlatformSettings(rawSettings, platformId);
    if (
      settings.enabled === undefined &&
      !settings.notes &&
      (!settings.defaultHashtags || settings.defaultHashtags.length === 0)
    ) {
      continue;
    }
    normalized[platformId] = settings;
  }
  return normalized;
}

function inferTaskContentType(mediaUrl?: string, mediaType?: ManualPublishMediaType): 'text' | 'image' | 'video' | 'link' {
  const normalizedUrl = trimString(mediaUrl).toLowerCase();
  if (!normalizedUrl) return 'text';
  if (mediaType) return mediaType;
  if (/\.(mp4|mov|webm|m4v|avi)($|\?)/.test(normalizedUrl)) return 'video';
  if (/\.(png|jpe?g|gif|webp)($|\?)/.test(normalizedUrl)) return 'image';
  return 'link';
}

function mapExecutionToManualResult(
  execution: TaskExecution,
  accountById: Map<string, PlatformAccount>,
  fallbackPlatformId: PlatformId
): ManualPublishExecutionResult {
  const responseData = asRecord(execution.responseData);
  const targetAccount = accountById.get(execution.targetAccount);
  const platformId =
    asManagedPlatformId(targetAccount?.platformId || trimString(responseData.targetPlatformId)) ||
    fallbackPlatformId;

  return {
    accountId: execution.targetAccount,
    platformId,
    accountName:
      trimString(targetAccount?.accountName) ||
      trimString(responseData.targetAccountName) ||
      execution.targetAccount,
    success: execution.status === 'success',
    postId: trimString(responseData.postId) || undefined,
    url: trimString(responseData.url) || undefined,
    scheduledFor: trimString(responseData.scheduledFor) || undefined,
    error:
      execution.status === 'failed'
        ? trimString(execution.error || responseData.failureReason) || 'Failed to publish.'
        : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const parsed = publishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid publish payload' }, { status: 400 });
    }

    const uniqueAccountIds = [...new Set(parsed.data.accountIds.map((item) => item.trim()).filter(Boolean))];
    if (uniqueAccountIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Select at least one account.' }, { status: 400 });
    }

    const userAccounts = await db.getUserAccounts(userId);
    const accountById = new Map(userAccounts.map((account) => [account.id, account]));
    const selectedAccounts = uniqueAccountIds
      .map((id) => accountById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (selectedAccounts.length !== uniqueAccountIds.length) {
      return NextResponse.json(
        { success: false, error: 'One or more selected accounts are invalid.' },
        { status: 400 }
      );
    }

    const scheduledAt =
      parsed.data.mode === 'schedule' && parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : undefined;

    const overrideMap =
      parsed.data.platformOverrides && typeof parsed.data.platformOverrides === 'object'
        ? (parsed.data.platformOverrides as Record<string, unknown>)
        : {};
    const normalizedOverrides = normalizePlatformOverrides(overrideMap);
    const settingsMap =
      parsed.data.platformSettings && typeof parsed.data.platformSettings === 'object'
        ? (parsed.data.platformSettings as Record<string, unknown>)
        : {};
    const normalizedPlatformSettings = normalizePlatformSettings(settingsMap);

    const selectedAccountsFiltered = selectedAccounts.filter((account) => {
      const platformId = asManagedPlatformId(account.platformId);
      if (!platformId) return true;
      const settings = extractPlatformSettings(settingsMap, platformId);
      return settings.enabled !== false;
    });

    if (selectedAccountsFiltered.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All selected platforms are disabled in platform settings.' },
        { status: 400 }
      );
    }

    let bufferSettingsPromise: Promise<Awaited<ReturnType<typeof getBufferUserSettings>>> | null = null;
    async function getBufferSettingsCached() {
      if (!bufferSettingsPromise) {
        bufferSettingsPromise = getBufferUserSettings(userId);
      }
      return bufferSettingsPromise;
    }

    async function resolvePublishTokenForAccount(
      account: PlatformAccount,
      provider: PlatformApiProvider
    ): Promise<string> {
      if (provider === 'buffer') {
        const settings = await getBufferSettingsCached();
        return createBufferPublishTokenForAccount({
          userId,
          accessToken:
            settings.accessToken ||
            trimString(account.accessToken) ||
            trimString((account.credentials as Record<string, unknown>)?.accessToken) ||
            trimString((account.credentials as Record<string, unknown>)?.apiKey),
          baseUrl: settings.baseUrl,
          applyToAllAccounts: false,
          account: {
            accountId: account.accountId,
            accountUsername: account.accountUsername,
            accountName: account.accountName,
            credentials: account.credentials,
          },
        });
      }

      return (
        trimString(account.accessToken) ||
        trimString((account.credentials as Record<string, unknown>)?.accessToken) ||
        trimString((account.credentials as Record<string, unknown>)?.apiKey)
      );
    }

    const validationReport = await Promise.all(
      selectedAccountsFiltered.map(async (account) => {
        const platformId = asManagedPlatformId(account.platformId);
        if (!platformId) {
          return {
            accountId: account.id,
            platformId: account.platformId,
            accountName: account.accountName,
            issues: [{ level: 'error' as const, message: `Unsupported platform: ${account.platformId}` }],
          };
        }

        const override = extractPlatformOverride(overrideMap, platformId);
        const message = override.message ?? parsed.data.message;
        const mediaUrl = override.mediaUrl ?? parsed.data.mediaUrl;
        const mediaType = override.mediaType ?? parsed.data.mediaType;
        const issues = validateManualPublishForPlatform({
          platformId,
          mode: parsed.data.mode,
          message,
          mediaUrl,
          mediaType,
          scheduledAt,
        });

        if (parsed.data.dryRun && parsed.data.checkConnectivity && issues.every((issue) => issue.level !== 'error')) {
          try {
            const provider = await getPlatformApiProviderForUser(userId, platformId);
            const handler = await getPlatformHandlerForUser(userId, platformId);
            const token = await resolvePublishTokenForAccount(account, provider);
            if (!token) {
              issues.push({
                level: 'error',
                message: 'Missing publish token for selected account.',
              });
            } else {
              const accountInfo = await handler.getAccountInfo(token);
              if (!accountInfo) {
                issues.push({
                  level: 'error',
                  message: 'Account connectivity check failed. Reconnect this account before publishing.',
                });
              }
            }
          } catch (error) {
            issues.push({
              level: 'error',
              message: error instanceof Error ? error.message : 'Connectivity check failed.',
            });
          }
        }

        return {
          accountId: account.id,
          platformId,
          accountName: account.accountName,
          issues,
        };
      })
    );

    const hasValidationErrors = validationReport.some((entry) =>
      entry.issues.some((issue) => issue.level === 'error')
    );

    if (parsed.data.dryRun) {
      return NextResponse.json({
        success: !hasValidationErrors,
        dryRun: true,
        validation: validationReport,
      });
    }

    if (hasValidationErrors) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed for one or more accounts.',
          validation: validationReport,
        },
        { status: 400 }
      );
    }

    const sourcePlatformId =
      asManagedPlatformId(selectedAccountsFiltered[0]?.platformId || '') || 'facebook';
    const manualSourceAccountId = `${MANUAL_SOURCE_ACCOUNT_PREFIX}${randomUUID()}`;
    const manualSourceLabel = 'Manual Source';

    const manualTask = await db.createTask({
      id: randomUUID(),
      userId,
      name:
        parsed.data.mode === 'schedule'
          ? `Manual Scheduled Publish ${new Date().toISOString()}`
          : `Manual Publish ${new Date().toISOString()}`,
      description: parsed.data.message,
      sourceAccounts: [manualSourceAccountId],
      targetAccounts: selectedAccountsFiltered.map((account) => account.id),
      contentType: inferTaskContentType(parsed.data.mediaUrl, parsed.data.mediaType),
      status: 'active',
      executionType: parsed.data.mode === 'schedule' ? 'scheduled' : 'immediate',
      scheduleTime: parsed.data.mode === 'schedule' ? scheduledAt : undefined,
      recurringPattern: undefined,
      recurringDays: undefined,
      filters: undefined,
      transformations: {
        manualPublish: {
          enabled: true,
          sourceAccountId: manualSourceAccountId,
          sourceLabel: manualSourceLabel,
          sourcePlatformId,
          mode: parsed.data.mode,
          message: parsed.data.message,
          mediaUrl: parsed.data.mediaUrl,
          mediaType: parsed.data.mediaType,
          platformOverrides: normalizedOverrides,
          platformSettings: normalizedPlatformSettings,
          createdAt: new Date().toISOString(),
        },
        automationSources: [
          {
            accountId: manualSourceAccountId,
            platformId: sourcePlatformId,
            accountLabel: manualSourceLabel,
            triggerId: 'manual_compose',
          },
        ],
        automationTargets: selectedAccountsFiltered.map((account) => ({
          accountId: account.id,
          platformId: account.platformId,
          accountLabel: account.accountName,
          actionId: 'manual_publish',
        })),
      },
      executionCount: 0,
      failureCount: 0,
      lastError: undefined,
    });

    if (parsed.data.mode === 'schedule') {
      return NextResponse.json({
        success: true,
        queued: true,
        taskId: manualTask.id,
        partialSuccess: false,
        succeededCount: 0,
        failedCount: 0,
        mode: parsed.data.mode,
        scheduledAt: scheduledAt?.toISOString(),
        results: [],
        validation: validationReport,
      });
    }

    const executionResults = await executionQueue.enqueue({
      label: 'api:manual-publish',
      userId,
      taskId: manualTask.id,
      dedupeKey: `api:manual-publish:${userId}:${manualTask.id}`,
      run: async () => taskProcessor.processTask(manualTask.id),
    });

    const results = executionResults.map((execution) =>
      mapExecutionToManualResult(execution, accountById, sourcePlatformId)
    );

    const succeededCount = results.filter((item) => item.success).length;
    const failedCount = results.length - succeededCount;
    const partialSuccess = succeededCount > 0 && failedCount > 0;

    await db.updateTask(manualTask.id, {
      status: failedCount > 0 ? 'error' : 'completed',
      lastError: failedCount > 0 ? 'One or more manual publish targets failed.' : undefined,
    });

    return NextResponse.json({
      success: succeededCount > 0 && failedCount === 0,
      taskId: manualTask.id,
      partialSuccess,
      succeededCount,
      failedCount,
      mode: parsed.data.mode,
      scheduledAt: scheduledAt?.toISOString(),
      results,
      validation: validationReport,
    });
  } catch (error) {
    console.error('[API] Manual publish error:', error);
    return NextResponse.json({ success: false, error: 'Failed to publish content.' }, { status: 500 });
  }
}
