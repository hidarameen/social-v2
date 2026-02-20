import { db, type Task, type PlatformAccount, type TaskExecution } from '@/lib/db';
import { getPlatformHandlerForUser } from '@/lib/platforms/handlers';
import {
  getPlatformApiProviderForUser,
  type PlatformApiProvider,
} from '@/lib/platforms/provider';
import type { PlatformId, PostRequest } from '@/lib/platforms/types';
import { randomUUID } from 'crypto';
import {
  createBufferPublishToken,
  createBufferPublishTokenForAccount,
  getBufferUserSettings,
} from '@/lib/buffer-user-settings';

const GENERIC_TASK_SUPPORTED_TARGETS_NATIVE = new Set<PlatformId>([
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

type ManualPublishPlatformOverride = {
  message?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'link';
};

type ManualPublishTaskConfig = {
  enabled: true;
  sourceAccountId: string;
  sourceLabel: string;
  sourcePlatformId?: PlatformId;
  mode: 'now' | 'schedule';
  message: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'link';
  platformOverrides: Partial<Record<PlatformId, ManualPublishPlatformOverride>>;
};

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asMediaType(value: unknown): 'image' | 'video' | 'link' | undefined {
  if (value === 'image' || value === 'video' || value === 'link') return value;
  return undefined;
}

function inferMediaType(mediaUrl?: string): 'image' | 'video' | 'link' | undefined {
  const source = trimString(mediaUrl).toLowerCase();
  if (!source) return undefined;
  if (/\.(mp4|mov|webm|m4v|avi)($|\?)/.test(source)) return 'video';
  if (/\.(png|jpe?g|gif|webp)($|\?)/.test(source)) return 'image';
  return 'link';
}

function asPlatformId(value: unknown): PlatformId | null {
  const candidate = trimString(value);
  if (!candidate) return null;
  return GENERIC_TASK_SUPPORTED_TARGETS_NATIVE.has(candidate as PlatformId)
    ? (candidate as PlatformId)
    : null;
}

export class TaskProcessor {
  /**
   * معالج المهام الشامل - ينقل المحتوى من مصدر إلى هدف واحد أو أكثر
   */
  async processTask(taskId: string): Promise<TaskExecution[]> {
    const task = await db.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const manualPublishConfig = this.getManualPublishTaskConfig(task);
    if (manualPublishConfig?.enabled) {
      return this.processManualPublishTask(task, manualPublishConfig);
    }

    const executions: TaskExecution[] = [];
    let failures = 0;
    const executionGroupId = `manual:${task.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    // الحصول على حسابات المصدر والهدف
    const sourceAccounts = (
      await Promise.all(task.sourceAccounts.map(id => db.getAccount(id)))
    ).filter(Boolean) as PlatformAccount[];

    const targetAccounts = (
      await Promise.all(task.targetAccounts.map(id => db.getAccount(id)))
    ).filter(Boolean) as PlatformAccount[];

    if (sourceAccounts.length === 0 || targetAccounts.length === 0) {
      throw new Error('Source or target accounts not found');
    }

    const providerByTargetId = new Map<string, PlatformApiProvider>();
    for (const targetAccount of targetAccounts) {
      const targetPlatformId = targetAccount.platformId as PlatformId;
      providerByTargetId.set(
        targetAccount.id,
        await getPlatformApiProviderForUser(task.userId, targetPlatformId)
      );
    }

    const bufferSettings = await getBufferUserSettings(task.userId);
    const applyBufferToAllAccounts = bufferSettings.applyToAllAccounts !== false;

    const dedupedTargetAccounts: PlatformAccount[] = [];
    const seenBufferPlatforms = new Set<PlatformId>();
    for (const targetAccount of targetAccounts) {
      const provider = providerByTargetId.get(targetAccount.id) || 'native';
      const targetPlatformId = targetAccount.platformId as PlatformId;
      if (provider === 'buffer' && applyBufferToAllAccounts) {
        if (seenBufferPlatforms.has(targetPlatformId)) {
          continue;
        }
        seenBufferPlatforms.add(targetPlatformId);
      }
      dedupedTargetAccounts.push(targetAccount);
    }

    const bufferPublishTokenByTargetId = new Map<string, string>();
    for (const targetAccount of dedupedTargetAccounts) {
      if ((providerByTargetId.get(targetAccount.id) || 'native') !== 'buffer') continue;
      bufferPublishTokenByTargetId.set(
        targetAccount.id,
        createBufferPublishTokenForAccount({
          userId: task.userId,
          accessToken: bufferSettings.accessToken,
          baseUrl: bufferSettings.baseUrl,
          applyToAllAccounts: applyBufferToAllAccounts,
          account: targetAccount,
        })
      );
    }

    // معالجة كل زوج من (مصدر -> هدف) بالتوازي
    const routePairs = sourceAccounts.flatMap((sourceAccount) =>
      dedupedTargetAccounts.map((targetAccount) => ({
        sourceAccount,
        targetAccount,
        targetProvider: providerByTargetId.get(targetAccount.id) || 'native',
        bufferPublishToken: bufferPublishTokenByTargetId.get(targetAccount.id),
      }))
    );

    const executionResults = await Promise.all(
      routePairs.map(async ({ sourceAccount, targetAccount, targetProvider, bufferPublishToken }) => {
        try {
          return await this.executeTransfer(
            task,
            sourceAccount,
            targetAccount,
            executionGroupId,
            targetProvider,
            bufferPublishToken,
          );
        } catch (error) {
          return db.createExecution({
            taskId,
            sourceAccount: sourceAccount.id,
            targetAccount: targetAccount.id,
            originalContent: task.description,
            transformedContent: '',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            executedAt: new Date(),
            responseData: {
              executionGroupId,
              progress: 100,
              stage: 'failed',
              failureReason: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      })
    );

    executions.push(...executionResults);
    failures += executionResults.filter((execution) => execution.status === 'failed').length;

    // تحديث آخر تنفيذ للمهمة
    await db.updateTask(taskId, {
      lastExecuted: new Date(),
      executionCount: task.executionCount + executions.length,
      failureCount: task.failureCount + failures,
      lastError: failures > 0 ? 'One or more executions failed' : undefined,
    });

    return executions;
  }

  private getManualPublishTaskConfig(task: Task): ManualPublishTaskConfig | null {
    const raw = asRecord(task.transformations?.manualPublish);
    if (Object.keys(raw).length === 0) return null;
    if (raw.enabled === false) return null;

    const sourceAccountId =
      trimString(raw.sourceAccountId) || `${MANUAL_SOURCE_ACCOUNT_PREFIX}${task.id}`;
    const sourceLabel = trimString(raw.sourceLabel) || 'Manual Source';
    const sourcePlatformId = asPlatformId(raw.sourcePlatformId) || undefined;
    const mode = raw.mode === 'schedule' ? 'schedule' : 'now';
    const message = String(raw.message ?? task.description ?? '');
    const mediaUrl = trimString(raw.mediaUrl) || undefined;
    const mediaType = asMediaType(raw.mediaType);

    const platformOverrides: Partial<Record<PlatformId, ManualPublishPlatformOverride>> = {};
    for (const [platformKey, overrideCandidate] of Object.entries(asRecord(raw.platformOverrides))) {
      const platformId = asPlatformId(platformKey);
      if (!platformId) continue;
      const parsed = asRecord(overrideCandidate);
      const override: ManualPublishPlatformOverride = {
        message: trimString(parsed.message) || undefined,
        mediaUrl: trimString(parsed.mediaUrl) || undefined,
        mediaType: asMediaType(parsed.mediaType),
      };
      if (override.message || override.mediaUrl || override.mediaType) {
        platformOverrides[platformId] = override;
      }
    }

    return {
      enabled: true,
      sourceAccountId,
      sourceLabel,
      sourcePlatformId,
      mode,
      message,
      mediaUrl,
      mediaType,
      platformOverrides,
    };
  }

  private async processManualPublishTask(
    task: Task,
    manualConfig: ManualPublishTaskConfig
  ): Promise<TaskExecution[]> {
    const executions: TaskExecution[] = [];
    let failures = 0;
    const executionGroupId = `manual:${task.id}:${Date.now()}:${randomUUID().slice(0, 8)}`;

    const targetAccounts = (
      await Promise.all(task.targetAccounts.map((id) => db.getAccount(id)))
    ).filter(Boolean) as PlatformAccount[];

    if (targetAccounts.length === 0) {
      throw new Error('Target accounts not found');
    }

    const providerByTargetId = new Map<string, PlatformApiProvider>();
    for (const targetAccount of targetAccounts) {
      const targetPlatformId = targetAccount.platformId as PlatformId;
      providerByTargetId.set(
        targetAccount.id,
        await getPlatformApiProviderForUser(task.userId, targetPlatformId)
      );
    }

    const bufferSettings = await getBufferUserSettings(task.userId);
    const applyBufferToAllAccounts = bufferSettings.applyToAllAccounts !== false;

    const dedupedTargetAccounts: PlatformAccount[] = [];
    const seenBufferPlatforms = new Set<PlatformId>();
    for (const targetAccount of targetAccounts) {
      const provider = providerByTargetId.get(targetAccount.id) || 'native';
      const targetPlatformId = targetAccount.platformId as PlatformId;
      if (provider === 'buffer' && applyBufferToAllAccounts) {
        if (seenBufferPlatforms.has(targetPlatformId)) {
          continue;
        }
        seenBufferPlatforms.add(targetPlatformId);
      }
      dedupedTargetAccounts.push(targetAccount);
    }

    const bufferPublishTokenByTargetId = new Map<string, string>();
    for (const targetAccount of dedupedTargetAccounts) {
      if ((providerByTargetId.get(targetAccount.id) || 'native') !== 'buffer') continue;
      bufferPublishTokenByTargetId.set(
        targetAccount.id,
        createBufferPublishTokenForAccount({
          userId: task.userId,
          accessToken: bufferSettings.accessToken,
          baseUrl: bufferSettings.baseUrl,
          applyToAllAccounts: applyBufferToAllAccounts,
          account: targetAccount,
        })
      );
    }

    const executionResults = await Promise.all(
      dedupedTargetAccounts.map(async (targetAccount) => {
        const targetPlatformId = targetAccount.platformId as PlatformId;
        try {
          return await this.executeManualPublishTarget(
            task,
            manualConfig,
            targetAccount,
            executionGroupId,
            providerByTargetId.get(targetAccount.id) || 'native',
            bufferPublishTokenByTargetId.get(targetAccount.id)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          return db.createExecution({
            taskId: task.id,
            sourceAccount: manualConfig.sourceAccountId,
            targetAccount: targetAccount.id,
            originalContent: manualConfig.message || task.description,
            transformedContent: '',
            status: 'failed',
            error: message,
            executedAt: new Date(),
            responseData: {
              sourcePlatformId: manualConfig.sourcePlatformId || targetPlatformId,
              manualSourcePlatformId: manualConfig.sourcePlatformId || targetPlatformId,
              manualSourceLabel: manualConfig.sourceLabel,
              targetPlatformId,
              targetAccountName: targetAccount.accountName,
              executionGroupId,
              progress: 100,
              stage: 'failed',
              failureReason: message,
            },
          });
        }
      })
    );

    executions.push(...executionResults);
    failures += executionResults.filter((execution) => execution.status === 'failed').length;

    await db.updateTask(task.id, {
      lastExecuted: new Date(),
      executionCount: task.executionCount + executions.length,
      failureCount: task.failureCount + failures,
      lastError: failures > 0 ? 'One or more executions failed' : undefined,
    });

    return executions;
  }

  private async executeManualPublishTarget(
    task: Task,
    manualConfig: ManualPublishTaskConfig,
    targetAccount: PlatformAccount,
    executionGroupId: string,
    targetProvider?: PlatformApiProvider,
    bufferPublishToken?: string
  ): Promise<TaskExecution> {
    const targetPlatformId = targetAccount.platformId as PlatformId;

    const provider =
      targetProvider ||
      (await getPlatformApiProviderForUser(task.userId, targetPlatformId));

    if (provider === 'native' && !GENERIC_TASK_SUPPORTED_TARGETS_NATIVE.has(targetPlatformId)) {
      throw new Error(
        `Generic task execution for target platform "${targetAccount.platformId}" is not implemented.`
      );
    }

    const targetHandler = await getPlatformHandlerForUser(task.userId, targetPlatformId);
    const override = manualConfig.platformOverrides[targetPlatformId] || {};

    const sourcePlatformId = manualConfig.sourcePlatformId || targetPlatformId;
    const baseResponseData = {
      sourcePlatformId,
      manualSourcePlatformId: sourcePlatformId,
      manualSourceLabel: manualConfig.sourceLabel,
      targetPlatformId,
      targetAccountName: targetAccount.accountName,
      executionGroupId,
    };

    const originalContent =
      String(override.message ?? manualConfig.message ?? task.description ?? '');

    const pendingExecution = await db.createExecution({
      taskId: task.id,
      sourceAccount: manualConfig.sourceAccountId,
      targetAccount: targetAccount.id,
      originalContent,
      transformedContent: originalContent,
      status: 'pending',
      executedAt: new Date(),
      responseData: {
        ...baseResponseData,
        progress: 8,
        stage: 'queued',
      },
    });

    try {
      let transformedContent = originalContent;
      if (task.transformations) {
        transformedContent = this.applyTransformations(
          transformedContent,
          task.transformations
        );
      }

      await db.updateExecution(pendingExecution.id, {
        transformedContent,
        responseData: {
          ...baseResponseData,
          progress: 34,
          stage: 'transforming',
        },
      });

      const mediaUrl = trimString(override.mediaUrl ?? manualConfig.mediaUrl) || undefined;
      const mediaType =
        override.mediaType ??
        manualConfig.mediaType ??
        inferMediaType(mediaUrl) ??
        'link';

      const postRequest: PostRequest = {
        content: transformedContent,
        media: mediaUrl
          ? {
              type: mediaType,
              url: mediaUrl,
            }
          : undefined,
        scheduleTime: task.scheduleTime,
        hashtags: task.transformations?.addHashtags,
      };

      await db.updateExecution(pendingExecution.id, {
        responseData: {
          ...baseResponseData,
          progress: 72,
          stage:
            task.executionType === 'scheduled' && task.scheduleTime
              ? 'scheduling'
              : 'publishing',
        },
      });

      const publishToken =
        provider === 'buffer'
          ? bufferPublishToken || createBufferPublishToken({ userId: task.userId })
          : targetAccount.accessToken;

      const postResponse =
        task.executionType === 'scheduled' && task.scheduleTime
          ? await targetHandler.schedulePost(postRequest, publishToken)
          : await targetHandler.publishPost(postRequest, publishToken);

      if (!postResponse.success) {
        throw new Error(postResponse.error || 'Failed to publish');
      }

      return db.updateExecution(pendingExecution.id, {
        transformedContent,
        status: 'success',
        error: null,
        executedAt: new Date(),
        responseData: {
          ...baseResponseData,
          progress: 100,
          stage: 'completed',
          postId: postResponse.postId,
          url: postResponse.url,
          scheduledFor: postResponse.scheduledFor?.toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return db.updateExecution(pendingExecution.id, {
        status: 'failed',
        error: message,
        executedAt: new Date(),
        responseData: {
          ...baseResponseData,
          progress: 100,
          stage: 'failed',
          failureReason: message,
        },
      });
    }
  }

  /**
   * نقل محتوى من حساب مصدر إلى حساب هدف
   */
  private async executeTransfer(
    task: Task,
    sourceAccount: PlatformAccount,
    targetAccount: PlatformAccount,
    executionGroupId: string,
    targetProvider?: PlatformApiProvider,
    bufferPublishToken?: string
  ): Promise<TaskExecution> {
    const sourcePlatformId = sourceAccount.platformId as PlatformId;
    const targetPlatformId = targetAccount.platformId as PlatformId;

    const provider =
      targetProvider ||
      (await getPlatformApiProviderForUser(task.userId, targetPlatformId));
    if (provider === 'native' && !GENERIC_TASK_SUPPORTED_TARGETS_NATIVE.has(targetPlatformId)) {
      throw new Error(
        `Generic task execution for target platform "${targetAccount.platformId}" is not implemented. Use platform-specific webhook automation for this route.`
      );
    }

    // الحصول على معالجات المنصات
    const targetHandler = await getPlatformHandlerForUser(task.userId, targetPlatformId);

    const baseResponseData = {
      sourcePlatformId,
      targetPlatformId,
      executionGroupId,
    };

    const pendingExecution = await db.createExecution({
      taskId: task.id,
      sourceAccount: sourceAccount.id,
      targetAccount: targetAccount.id,
      originalContent: task.description,
      transformedContent: task.description,
      status: 'pending',
      executedAt: new Date(),
      responseData: {
        ...baseResponseData,
        progress: 8,
        stage: 'queued',
      },
    });

    try {
      // تحويل المحتوى
      let transformedContent = task.description;
      if (task.transformations) {
        transformedContent = this.applyTransformations(
          transformedContent,
          task.transformations
        );
      }

      await db.updateExecution(pendingExecution.id, {
        transformedContent,
        responseData: {
          ...baseResponseData,
          progress: 34,
          stage: 'transforming',
        },
      });

      // إرسال إلى المنصة الهدف
      const postRequest = {
        content: transformedContent,
        scheduleTime: task.scheduleTime,
        hashtags: task.transformations?.addHashtags,
      };

      await db.updateExecution(pendingExecution.id, {
        responseData: {
          ...baseResponseData,
          progress: 72,
          stage:
            task.executionType === 'scheduled' && task.scheduleTime
              ? 'scheduling'
              : 'publishing',
        },
      });

      let postResponse;
      const publishToken =
        provider === 'buffer'
          ? bufferPublishToken || createBufferPublishToken({ userId: task.userId })
          : targetAccount.accessToken;

      if (task.executionType === 'scheduled' && task.scheduleTime) {
        postResponse = await targetHandler.schedulePost(
          postRequest,
          publishToken
        );
      } else {
        postResponse = await targetHandler.publishPost(
          postRequest,
          publishToken
        );
      }

      if (!postResponse.success) {
        throw new Error(postResponse.error || 'Failed to publish');
      }

      return db.updateExecution(pendingExecution.id, {
        transformedContent,
        status: 'success',
        error: null,
        executedAt: new Date(),
        responseData: {
          ...baseResponseData,
          progress: 100,
          stage: 'completed',
          postId: postResponse.postId,
          url: postResponse.url,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return db.updateExecution(pendingExecution.id, {
        status: 'failed',
        error: message,
        executedAt: new Date(),
        responseData: {
          ...baseResponseData,
          progress: 100,
          stage: 'failed',
          failureReason: message,
        },
      });
    }
  }

  /**
   * تطبيق التحويلات على المحتوى
   */
  private applyTransformations(
    content: string,
    transformations: Task['transformations']
  ): string {
    let result = content;

    if (transformations?.prependText) {
      result = `${transformations.prependText}\n${result}`;
    }

    if (transformations?.appendText) {
      result = `${result}\n${transformations.appendText}`;
    }

    if (transformations?.addHashtags && transformations.addHashtags.length > 0) {
      result = `${result}\n\n${transformations.addHashtags.join(' ')}`;
    }

    return result;
  }

  /**
   * معالجة مهام متكررة
   */
  async processRecurringTasks(): Promise<void> {
    // هذا سيتم تشغيله بواسطة cron job في الإنتاج
    const allTasks = await db.getAllTasks();
    for (const task of allTasks) {
      if (task.status !== 'active' || task.executionType !== 'recurring') continue;

      const shouldExecute = this.shouldExecuteRecurring(task);
      if (shouldExecute) {
        await this.processTask(task.id);
      }
    }
  }

  /**
   * التحقق من ما إذا كان يجب تنفيذ المهمة المتكررة
   */
  private shouldExecuteRecurring(task: Task): boolean {
    if (!task.lastExecuted) return true;

    const now = new Date();
    const lastExec = new Date(task.lastExecuted);

    switch (task.recurringPattern) {
      case 'daily':
        return (now.getTime() - lastExec.getTime()) >= 24 * 60 * 60 * 1000;
      case 'weekly':
        return (now.getTime() - lastExec.getTime()) >= 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return (now.getTime() - lastExec.getTime()) >= 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  /**
   * تصفية المحتوى بناءً على الفلاتر
   */
  applyFilters(content: string, filters?: Task['filters']): boolean {
    if (!filters) return true;

    // فلتر الكلمات الرئيسية
    if (filters.keywords && filters.keywords.length > 0) {
      const hasKeyword = filters.keywords.some(keyword =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // فلتر الكلمات المستبعدة
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const hasExcluded = filters.excludeKeywords.some(keyword =>
        content.toLowerCase().includes(keyword.toLowerCase())
      );
      if (hasExcluded) return false;
    }

    return true;
  }

  /**
   * الحصول على إحصائيات التنفيذ
   */
  async getExecutionStats(taskId: string) {
    const executions = await db.getTaskExecutions(taskId);
    
    // التحقق من أن executions هو مصفوفة
    if (!Array.isArray(executions)) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        lastExecuted: undefined,
      };
    }

    const successfulExecutions = executions.filter(e => e.status === 'success');
    const failedExecutions = executions.filter(e => e.status === 'failed');

    return {
      total: executions.length,
      successful: successfulExecutions.length,
      failed: failedExecutions.length,
      successRate:
        executions.length > 0
          ? (
              (successfulExecutions.length / executions.length) *
              100
            ).toFixed(2)
          : '0',
      lastExecuted:
        executions.length > 0
          ? executions.sort(
              (a, b) =>
                new Date(b.executedAt).getTime() -
                new Date(a.executedAt).getTime()
            )[0]?.executedAt
          : undefined,
    };
  }
}

export const taskProcessor = new TaskProcessor();
