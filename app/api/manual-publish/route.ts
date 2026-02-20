import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { db, type PlatformAccount } from '@/lib/db';
import type { PlatformId, PostRequest } from '@/lib/platforms/types';
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
  ManualPublishExecutionResult,
  ManualPublishMediaType,
} from '@/lib/manual-publish/types';

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

const MANUAL_PUBLISH_REQUIRED_PROVIDER: PlatformApiProvider = 'buffer';

const publishSchema = z.object({
  message: z.string().max(10000).default(''),
  mediaUrl: z.string().max(2000).optional(),
  mediaType: z.enum(['image', 'video', 'link']).optional(),
  accountIds: z.array(z.string().min(1)).min(1),
  mode: z.enum(['now', 'schedule']).default('now'),
  scheduledAt: z.string().optional(),
  platformOverrides: z.record(z.any()).optional(),
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

function getProviderRequirementIssue(provider: PlatformApiProvider, platformId: PlatformId): string | null {
  if (provider === MANUAL_PUBLISH_REQUIRED_PROVIDER) {
    return null;
  }
  return `Manual publish for ${platformId} requires Buffer provider. Enable Buffer for this platform in Settings.`;
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
      selectedAccounts.map(async (account) => {
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

        const provider = await getPlatformApiProviderForUser(userId, platformId);
        const providerIssue = getProviderRequirementIssue(provider, platformId);
        if (providerIssue) {
          issues.push({ level: 'error', message: providerIssue });
        }

        if (parsed.data.dryRun && parsed.data.checkConnectivity && issues.every((issue) => issue.level !== 'error')) {
          try {
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

    const results: ManualPublishExecutionResult[] = [];

    for (const account of selectedAccounts) {
      const platformId = asManagedPlatformId(account.platformId);
      if (!platformId) {
        continue;
      }

      const override = extractPlatformOverride(overrideMap, platformId);
      const content = override.message ?? parsed.data.message;
      const mediaUrl = override.mediaUrl ?? parsed.data.mediaUrl;
      const mediaType = override.mediaType ?? parsed.data.mediaType ?? 'link';

      const post: PostRequest = {
        content,
        media: mediaUrl
          ? {
              type: mediaType,
              url: mediaUrl,
            }
          : undefined,
        scheduleTime: parsed.data.mode === 'schedule' ? scheduledAt : undefined,
      };

      try {
        const provider = await getPlatformApiProviderForUser(userId, platformId);
        const providerIssue = getProviderRequirementIssue(provider, platformId);
        if (providerIssue) {
          results.push({
            accountId: account.id,
            platformId,
            accountName: account.accountName,
            success: false,
            error: providerIssue,
          });
          continue;
        }

        const handler = await getPlatformHandlerForUser(userId, platformId);
        const token = await resolvePublishTokenForAccount(account, provider);
        if (!token) {
          results.push({
            accountId: account.id,
            platformId,
            accountName: account.accountName,
            success: false,
            error: 'Missing publish token for selected account.',
          });
          continue;
        }

        const response =
          parsed.data.mode === 'schedule'
            ? await handler.schedulePost(post, token)
            : await handler.publishPost(post, token);

        results.push({
          accountId: account.id,
          platformId,
          accountName: account.accountName,
          success: Boolean(response.success),
          postId: response.postId,
          url: response.url,
          scheduledFor: response.scheduledFor ? response.scheduledFor.toISOString() : undefined,
          error: response.error,
        });
      } catch (error) {
        results.push({
          accountId: account.id,
          platformId,
          accountName: account.accountName,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to publish.',
        });
      }
    }

    const succeededCount = results.filter((item) => item.success).length;
    const failedCount = results.length - succeededCount;
    const partialSuccess = succeededCount > 0 && failedCount > 0;

    return NextResponse.json({
      success: succeededCount > 0 && failedCount === 0,
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
