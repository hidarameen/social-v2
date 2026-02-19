'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskExecution } from '@/lib/db';
import type { PlatformId } from '@/lib/platforms/types';
import { extractExecutionMessageLinks } from '@/lib/execution-links';
import {
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  FileText,
  ImageIcon,
  Layers,
  VideoIcon,
  Sparkles,
} from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { getCachedQuery, setCachedQuery } from '@/lib/client/query-cache';
import { toast } from 'sonner';
import { PlatformIcon } from '@/components/common/platform-icon';
import { cn } from '@/lib/utils';

interface ExpandedExecution extends TaskExecution {
  taskName?: string;
  sourceAccountName?: string;
  targetAccountName?: string;
  sourcePlatformId?: string;
  targetPlatformId?: string;
}

function getExecutionGroupId(execution: ExpandedExecution): string {
  const responseData =
    execution.responseData && typeof execution.responseData === 'object'
      ? (execution.responseData as Record<string, any>)
      : {};
  const explicit = String(responseData.executionGroupId || '').trim();
  if (explicit) return explicit;
  const sourceTweetId = String(responseData.sourceTweetId || '').trim();
  if (sourceTweetId) return `legacy:${execution.taskId}:tweet:${sourceTweetId}`;
  const secondBucket = Math.floor(new Date(execution.executedAt).getTime() / 1000);
  const contentKey = String(execution.originalContent || '').trim().slice(0, 80);
  return `legacy:${execution.taskId}:${execution.sourceAccount}:${secondBucket}:${contentKey}`;
}

function toDisplayText(value: string | undefined): string {
  const text = (value || '').trim();
  return text.length > 0 ? text : 'No text content';
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function getExecutionProgressSnapshot(responseData: unknown): {
  progress: number;
  stage?: string;
} {
  if (!responseData || typeof responseData !== 'object') {
    return { progress: 0 };
  }
  const record = responseData as Record<string, unknown>;
  const rawProgress = Number(record.progress);
  const stage = typeof record.stage === 'string' ? record.stage : undefined;
  return {
    progress: clampProgress(Number.isFinite(rawProgress) ? rawProgress : 0),
    stage,
  };
}

type ExecutionMessageKind = 'text' | 'media' | 'mixed';
type ExecutionMediaKind = 'image' | 'video' | 'media';

function toStageToken(stage: string | undefined): string {
  return String(stage || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
}

function toResponseRecord(responseData: unknown): Record<string, any> {
  if (!responseData || typeof responseData !== 'object') return {};
  return responseData as Record<string, any>;
}

function toNumberOrZero(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function inferMediaKind(responseData: unknown, stage: string | undefined): ExecutionMediaKind | undefined {
  const record = toResponseRecord(responseData);
  const stageToken = toStageToken(stage);
  const explicitKind = String(record.mediaKind || '').toLowerCase();
  if (explicitKind.includes('video')) return 'video';
  if (explicitKind.includes('photo') || explicitKind.includes('image')) return 'image';
  if (String(record.publishMode || '').toLowerCase().includes('video')) return 'video';
  if (stageToken.includes('video') || stageToken.includes('youtube')) return 'video';
  if (
    stageToken.includes('image') ||
    stageToken.includes('photo') ||
    stageToken.includes('album')
  ) {
    return 'image';
  }
  const hasAnyMediaSignals =
    toNumberOrZero(record.mediaCount) > 0 ||
    toNumberOrZero(record.uploadedMediaCount) > 0 ||
    (Array.isArray(record.mediaIds) && record.mediaIds.length > 0) ||
    Boolean(record.album) ||
    Boolean(record.publishMode);
  return hasAnyMediaSignals ? 'media' : undefined;
}

function inferMessageKind(execution: ExpandedExecution): {
  kind: ExecutionMessageKind;
  mediaKind?: ExecutionMediaKind;
  mediaCount: number;
} {
  const record = toResponseRecord(execution.responseData);
  const stage = typeof record.stage === 'string' ? record.stage : undefined;
  const mediaKind = inferMediaKind(record, stage);
  const mediaCount = Math.max(
    toNumberOrZero(record.mediaCount),
    toNumberOrZero(record.uploadedMediaCount),
    Array.isArray(record.mediaIds) ? record.mediaIds.length : 0
  );
  const hasMedia =
    Boolean(mediaKind) ||
    mediaCount > 0 ||
    toStageToken(stage).includes('media') ||
    toStageToken(stage).includes('video') ||
    toStageToken(stage).includes('image') ||
    toStageToken(stage).includes('photo');
  const hasText =
    String(execution.originalContent || '').trim().length > 0 ||
    String(execution.transformedContent || '').trim().length > 0;

  if (hasText && hasMedia) return { kind: 'mixed', mediaKind, mediaCount };
  if (hasMedia) return { kind: 'media', mediaKind, mediaCount };
  return { kind: 'text', mediaKind, mediaCount };
}

function formatExecutionStage(
  stage: string | undefined,
  sourcePlatformId: PlatformId | undefined,
  targetPlatformId: PlatformId | undefined,
  responseData: unknown
): string {
  const stageToken = toStageToken(stage);
  const mediaKind = inferMediaKind(responseData, stage);
  const mediaLabel =
    mediaKind === 'video' ? 'video' : mediaKind === 'image' ? 'image' : 'media';
  const source = platformLabel(sourcePlatformId);
  const target = platformLabel(targetPlatformId);

  if (!stageToken) return `Processing message from ${source} and preparing ${target}`;
  if (stageToken.includes('downloading')) return `Downloading ${mediaLabel} from ${source}`;
  if (stageToken.includes('downloaded')) return `${mediaLabel[0].toUpperCase()}${mediaLabel.slice(1)} downloaded from ${source}`;
  if (
    stageToken.includes('uploading') ||
    stageToken.includes('upload-start') ||
    stageToken.includes('resumable-transfer') ||
    (stageToken.includes('starting-') && stageToken.includes('upload'))
  ) {
    return `Uploading ${mediaLabel} to ${target}`;
  }
  if (stageToken.includes('uploaded')) return `${mediaLabel[0].toUpperCase()}${mediaLabel.slice(1)} uploaded to ${target}`;
  if (stageToken.includes('transcode')) return 'Transcoding video for destination requirements';
  if (stageToken.includes('playlist-attach')) return 'Attaching uploaded video to playlist';
  if (stageToken.includes('token-refreshed')) return 'Refreshing destination account token';
  if (stageToken.includes('tweet-posted') || stageToken.includes('text-post-complete') || stageToken.includes('done')) {
    return `Finalizing delivery to ${target}`;
  }
  if (stageToken.includes('publish') || stageToken.includes('sending') || stageToken.includes('schedule')) {
    return `Sending content to ${target}`;
  }
  if (stageToken.includes('process') || stageToken.includes('transform') || stageToken.includes('prepare')) {
    return 'Analyzing and preparing message payload';
  }

  const normalized = stageToken.replace(/-/g, ' ').trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

type StepState = 'done' | 'active' | 'pending' | 'failed';

function platformLabel(platformId?: PlatformId): string {
  if (!platformId) return 'source';
  if (platformId === 'twitter') return 'X';
  return platformId.charAt(0).toUpperCase() + platformId.slice(1);
}

function resolveStepState(
  stepIndex: number,
  status: TaskExecution['status'],
  stage: string | undefined
): StepState {
  const normalized = toStageToken(stage);
  const currentStepIndex =
    normalized.includes('done') || normalized.includes('complete') || normalized.includes('posted')
      ? 3
      : normalized.includes('publish') ||
          normalized.includes('schedule') ||
          normalized.includes('send') ||
          normalized.includes('upload')
        ? 2
        : normalized.includes('transform') ||
            normalized.includes('process') ||
            normalized.includes('prepare') ||
            normalized.includes('download')
          ? 1
          : 0;

  if (status === 'success') return 'done';
  if (status === 'failed') {
    if (stepIndex <= currentStepIndex) return 'done';
    if (stepIndex === 3) return 'failed';
    return 'pending';
  }
  if (stepIndex < currentStepIndex) return 'done';
  if (stepIndex === currentStepIndex) return 'active';
  return 'pending';
}

export default function ExecutionsPage() {
  const searchParams = useSearchParams();
  const [executions, setExecutions] = useState<ExpandedExecution[]>([]);
  const [filteredExecutions, setFilteredExecutions] = useState<ExpandedExecution[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [taskIdFilter, setTaskIdFilter] = useState(searchParams.get('taskId') || '');
  const [taskNameHint] = useState(searchParams.get('taskName') || '');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'executedAt' | 'status' | 'taskName'>('executedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 50;
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const isInitialLoading = isLoadingExecutions && executions.length === 0;
  const pendingExecutions = executions.filter((execution) => execution.status === 'pending');
  const pendingExecutionCount = pendingExecutions.length;
  const shouldLivePoll = pendingExecutionCount > 0;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const statusParam = statusFilter === 'all' ? '' : statusFilter;
    const cacheKey = `executions:list:${pageSize}:0:${debouncedSearchTerm}:${statusParam}:${taskIdFilter}:${sortBy}:${sortDir}`;
    const cached = getCachedQuery<{
      executions: ExpandedExecution[];
      nextOffset: number;
      hasMore: boolean;
    }>(cacheKey, 20_000);

    if (cached) {
      setExecutions(cached.executions);
      setFilteredExecutions(cached.executions);
      setOffset(cached.nextOffset);
      setHasMore(cached.hasMore);
      setIsLoadingExecutions(false);
    } else {
      setIsLoadingExecutions(true);
    }

    async function load() {
      try {
        const requestStatusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
        const requestTaskIdParam = taskIdFilter ? `&taskId=${encodeURIComponent(taskIdFilter)}` : '';
        const res = await fetch(
          `/api/executions?limit=${pageSize}&offset=0&search=${encodeURIComponent(debouncedSearchTerm)}${requestStatusParam}${requestTaskIdParam}&sortBy=${sortBy}&sortDir=${sortDir}`,
          { signal: controller.signal, cache: 'no-store' }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load executions');
        if (cancelled) return;
        const list = (data.executions || []) as ExpandedExecution[];
        const nextOffset = data.nextOffset || 0;
        const nextHasMore = Boolean(data.hasMore);
        setExecutions(list);
        setFilteredExecutions(list);
        setOffset(nextOffset);
        setHasMore(nextHasMore);
        setCachedQuery(cacheKey, {
          executions: list,
          nextOffset,
          hasMore: nextHasMore,
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[v0] ExecutionsPage: Error loading executions:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingExecutions(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pageSize, debouncedSearchTerm, statusFilter, taskIdFilter, sortBy, sortDir]);

  const handleRefresh = useCallback((options: { showLoading?: boolean } = {}) => {
    const showLoading = options.showLoading !== false;
    const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
    const taskIdParam = taskIdFilter ? `&taskId=${encodeURIComponent(taskIdFilter)}` : '';
    if (showLoading) {
      setIsLoadingExecutions(true);
    }

    return fetch(`/api/executions?limit=${pageSize}&offset=0&search=${encodeURIComponent(debouncedSearchTerm)}${statusParam}${taskIdParam}&sortBy=${sortBy}&sortDir=${sortDir}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to load executions');
        const list = (data.executions || []) as ExpandedExecution[];
        setExecutions(list);
        setFilteredExecutions(list);
        setOffset(data.nextOffset || 0);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(error => {
        console.error('[v0] ExecutionsPage: Error refreshing executions:', error);
      })
      .finally(() => {
        if (showLoading) {
          setIsLoadingExecutions(false);
        }
      });
  }, [debouncedSearchTerm, pageSize, sortBy, sortDir, statusFilter, taskIdFilter]);

  useEffect(() => {
    const refreshInterval = shouldLivePoll ? 2500 : 3500;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void handleRefresh({ showLoading: false });
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [handleRefresh, shouldLivePoll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let disposed = false;
    let stream: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1400);
    };

    const onExecutionChanged = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void handleRefresh({ showLoading: false });
    };

    const connect = () => {
      if (disposed) return;
      try {
        stream = new EventSource('/api/executions/stream');
      } catch {
        scheduleReconnect();
        return;
      }

      stream.addEventListener('ready', onExecutionChanged);
      stream.addEventListener('execution-changed', onExecutionChanged);
      stream.onerror = () => {
        try {
          stream?.close();
        } catch {
          // ignore
        }
        stream = null;
        scheduleReconnect();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      reconnectTimer = null;
      try {
        stream?.close();
      } catch {
        // ignore
      }
      stream = null;
    };
  }, [handleRefresh]);

  useEffect(() => {
    const triggerImmediateRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void handleRefresh({ showLoading: false });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerImmediateRefresh();
      }
    };

    window.addEventListener('focus', triggerImmediateRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', triggerImmediateRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);

  useEffect(() => {
    let filtered = executions;

    // Search filter
    if (searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        e =>
          e.taskName?.toLowerCase().includes(normalizedSearch) ||
          e.originalContent.toLowerCase().includes(normalizedSearch) ||
          e.sourceAccountName?.toLowerCase().includes(normalizedSearch) ||
          e.targetAccountName?.toLowerCase().includes(normalizedSearch)
      );
    }

    setFilteredExecutions(filtered);
  }, [searchTerm, statusFilter, executions]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const taskIdParam = taskIdFilter ? `&taskId=${encodeURIComponent(taskIdFilter)}` : '';
      const res = await fetch(
        `/api/executions?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearchTerm)}${statusParam}${taskIdParam}&sortBy=${sortBy}&sortDir=${sortDir}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load executions');
      const next = [...executions, ...(data.executions || [])];
      setExecutions(next);
      setFilteredExecutions(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] ExecutionsPage: Error loading more executions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    if (!taskId || retryingTaskId) return;
    try {
      setRetryingTaskId(taskId);
      const res = await fetch(`/api/tasks/${taskId}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to trigger retry');
      toast.success('Task retry queued successfully');
      await handleRefresh({ showLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to trigger retry');
    } finally {
      setRetryingTaskId(null);
    }
  };

  const groupedRuns = new Map<string, ExpandedExecution[]>();
  for (const execution of filteredExecutions) {
    const groupId = getExecutionGroupId(execution);
    const group = groupedRuns.get(groupId) || [];
    group.push(execution);
    groupedRuns.set(groupId, group);
  }

  const groupedRunList = Array.from(groupedRuns.entries()).map(([groupId, group]) => ({
    groupId,
    routes: group,
    lead: group[0],
  }));

  const stats = {
    total: groupedRunList.length,
    successful: groupedRunList.filter(({ routes }) => routes.every((e) => e.status === 'success')).length,
    failed: groupedRunList.filter(({ routes }) => !routes.some((e) => e.status === 'pending') && routes.some((e) => e.status === 'failed')).length,
    processing: groupedRunList.filter(({ routes }) => routes.some((e) => e.status === 'pending')).length,
  };
  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Runtime Timeline
            </p>
            <h1 className="page-title">Execution History</h1>
            <p className="page-subtitle">Track task executions, route-level state, and delivery results</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {isInitialLoading ? (
                <>
                  <span className="kpi-pill">Loading runs...</span>
                  <span className="kpi-pill">Loading success...</span>
                  <span className="kpi-pill">Loading failures...</span>
                </>
              ) : (
                <>
                  <span className="kpi-pill">{stats.total} total</span>
                  <span className="kpi-pill">{stats.successful} successful</span>
                  <span className="kpi-pill">{stats.failed} failed</span>
                  <span className="kpi-pill">{stats.processing} processing</span>
                </>
              )}
            </div>
            {taskIdFilter ? (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="kpi-pill">
                  Task scope: {taskNameHint || taskIdFilter}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setTaskIdFilter('')}>
                  Show all tasks
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void handleRefresh()}>
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/api/executions/export';
              }}
            >
              <Download size={18} className="mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {isInitialLoading ? (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((idx) => (
              <Card key={idx} className="surface-card">
                <CardContent className="pt-6">
                  <div className="animate-pulse space-y-3">
                    <div className="mx-auto h-3 w-24 rounded bg-muted/50" />
                    <div className="mx-auto h-8 w-16 rounded bg-muted/65" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="surface-card">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-1">Total Runs</p>
                  <p className="text-3xl font-bold text-foreground">{stats.total}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-1">Successful Runs</p>
                  <p className="text-3xl font-bold text-primary">
                    {stats.successful}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-1">Failed Runs</p>
                  <p className="text-3xl font-bold text-destructive">
                    {stats.failed}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="surface-card">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground text-sm mb-1">Processing Runs</p>
                  <p className="text-3xl font-bold text-secondary-foreground">
                    {stats.processing}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6 animate-fade-up sticky-toolbar surface-card">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by text, source, or target..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: any) => setStatusFilter(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Successful</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Processing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Sort By
                </label>
                <Select
                  value={`${sortBy}:${sortDir}`}
                  onValueChange={(value: string) => {
                    const [by, dir] = value.split(':') as any;
                    setSortBy(by);
                    setSortDir(dir);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executedAt:desc">Date (Newest)</SelectItem>
                    <SelectItem value="executedAt:asc">Date (Oldest)</SelectItem>
                    <SelectItem value="status:asc">Status (A→Z)</SelectItem>
                    <SelectItem value="status:desc">Status (Z→A)</SelectItem>
                    <SelectItem value="taskName:asc">Task (A→Z)</SelectItem>
                    <SelectItem value="taskName:desc">Task (Z→A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Task ID
                </label>
                <Input
                  placeholder="Optional task id..."
                  value={taskIdFilter}
                  onChange={(event) => setTaskIdFilter(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(searchTerm || statusFilter !== 'all' || taskIdFilter) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTaskIdFilter('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Executions List */}
        {isInitialLoading ? (
          <Card className="surface-card">
            <CardContent className="py-6">
              <div className="space-y-3">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="animate-pulse rounded-xl border border-border/60 p-4">
                    <div className="h-4 w-48 rounded bg-muted/55" />
                    <div className="mt-2 h-3 w-72 rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : filteredExecutions.length === 0 ? (
          <Card className="surface-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No executions found. {executions.length === 0 ? 'Create and run some tasks to see execution history.' : 'Try a different search filter.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {groupedRunList.map(({ groupId, routes, lead }) => {
              const taskLabel = lead.taskName || lead.taskId;
              const messageText = toDisplayText(lead.originalContent);
              const messagePreview =
                messageText.length > 220 ? `${messageText.slice(0, 220)}...` : messageText;
              const sourceLabels = Array.from(
                new Set(
                  routes.map((route) => route.sourceAccountName || route.sourceAccount || 'Unknown source')
                )
              );
              const targetLabels = Array.from(
                new Set(
                  routes.map((route) => route.targetAccountName || route.targetAccount || 'Unknown target')
                )
              );
              const sourcePlatforms = Array.from(
                new Set(routes.map((route) => route.sourcePlatformId).filter(Boolean))
              ) as PlatformId[];
              const targetPlatforms = Array.from(
                new Set(routes.map((route) => route.targetPlatformId).filter(Boolean))
              ) as PlatformId[];
              const sourcePlatformId = sourcePlatforms.length === 1 ? sourcePlatforms[0] : undefined;
              const targetPlatformId = targetPlatforms.length === 1 ? targetPlatforms[0] : undefined;
              const sourceSummary =
                sourceLabels.length === 1 ? sourceLabels[0] : `${sourceLabels.length} sources`;
              const targetSummary =
                targetLabels.length === 1 ? targetLabels[0] : `${targetLabels.length} targets`;

              const hasPending = routes.some((route) => route.status === 'pending');
              const hasFailed = routes.some((route) => route.status === 'failed');
              const hasSuccess = routes.some((route) => route.status === 'success');
              const isPartial = !hasPending && hasFailed && hasSuccess;
              const status: TaskExecution['status'] =
                hasPending ? 'pending' : hasFailed ? 'failed' : 'success';
              const statusText = hasPending
                ? 'Processing'
                : isPartial
                  ? 'Partial failure'
                  : hasFailed
                    ? 'Failed'
                    : 'Success';
              const statusClass = hasPending
                ? 'border border-secondary/35 bg-secondary/20 text-secondary-foreground'
                : hasFailed
                  ? 'border border-destructive/35 bg-destructive/10 text-destructive'
                  : 'border border-primary/30 bg-primary/10 text-primary';

              const pendingRoute = routes.find((route) => route.status === 'pending');
              const stageRoute = pendingRoute || lead;
              const stageSnapshot = getExecutionProgressSnapshot(stageRoute.responseData);
              const routeProgressSamples = routes
                .map((route) => getExecutionProgressSnapshot(route.responseData))
                .filter((snapshot) => snapshot.progress > 0);
              const averageProgress =
                routeProgressSamples.length > 0
                  ? Math.round(
                      routeProgressSamples.reduce((sum, snapshot) => sum + snapshot.progress, 0) /
                        routeProgressSamples.length
                    )
                  : 0;
              const liveProgress = averageProgress > 0 ? averageProgress : 20;
              const liveStage = formatExecutionStage(
                stageSnapshot.stage,
                sourcePlatformId,
                targetPlatformId,
                stageRoute.responseData
              );

              const messageKind = inferMessageKind(lead);
              const MessageKindIcon =
                messageKind.kind === 'mixed'
                  ? Layers
                  : messageKind.kind === 'media'
                    ? messageKind.mediaKind === 'video'
                      ? VideoIcon
                      : ImageIcon
                    : FileText;
              const messageKindLabel =
                messageKind.kind === 'mixed'
                  ? 'Text + media'
                  : messageKind.kind === 'media'
                    ? messageKind.mediaKind === 'video'
                      ? 'Video only'
                      : messageKind.mediaKind === 'image'
                        ? 'Image only'
                        : 'Media only'
                    : 'Text only';

              const steps = [
                {
                  id: 'received',
                  label: `Received from ${platformLabel(sourcePlatformId)}`,
                  state: resolveStepState(0, status, stageSnapshot.stage),
                },
                {
                  id: 'processing',
                  label: 'Analyzing and transforming message',
                  state: resolveStepState(1, status, stageSnapshot.stage),
                },
                {
                  id: 'sending',
                  label: `Sending to ${platformLabel(targetPlatformId)}`,
                  state: resolveStepState(2, status, stageSnapshot.stage),
                },
                {
                  id: 'result',
                  label: hasFailed ? 'Delivery failed' : hasPending ? 'Awaiting delivery result' : 'Delivered successfully',
                  state: resolveStepState(3, status, stageSnapshot.stage),
                },
              ];

              const groupErrors = routes
                .map((route) => String(route.error || '').trim())
                .filter(Boolean);

              const isExpanded = expandedId === groupId;

              return (
                <Fragment key={groupId}>
                  {routes.length > 1 ? (
                    <div className="px-1 pt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{taskLabel}</span>
                      <span className="mx-1">•</span>
                      <span>Grouped run with {routes.length} routes</span>
                    </div>
                  ) : null}
                  <Card className="surface-card cursor-pointer transition-colors hover:border-primary/50">
                    <CardContent className="p-6">
                      <div
                        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        onClick={() => setExpandedId(isExpanded ? null : groupId)}
                      >
                        <div className="flex-1">
                          <div className="mb-2 flex items-start gap-3">
                            <p className="font-semibold text-foreground break-words">{messagePreview}</p>
                            <span
                              className={`inline-block shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusClass}`}
                            >
                              {statusText}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Executed {new Date(lead.executedAt).toLocaleString()}
                          </p>
                          <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-border/65 bg-card/70 px-2.5 py-1 text-xs text-foreground">
                            {sourcePlatformId ? <PlatformIcon platformId={sourcePlatformId} size={13} /> : null}
                            <span className="max-w-[180px] truncate">{sourceSummary}</span>
                            <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
                            {targetPlatformId ? <PlatformIcon platformId={targetPlatformId} size={13} /> : null}
                            <span className="max-w-[180px] truncate">{targetSummary}</span>
                            <span className="ml-1 rounded-full border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px]">
                              {routes.length} route{routes.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1 text-foreground">
                              <MessageKindIcon size={13} />
                              <span>{messageKindLabel}</span>
                            </span>
                            {messageKind.mediaCount > 0 ? (
                              <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/35 px-2 py-1 text-muted-foreground">
                                {messageKind.mediaCount} media item{messageKind.mediaCount > 1 ? 's' : ''}
                              </span>
                            ) : null}
                          </div>

                          {hasPending && (
                            <div className="mt-4 execution-processing-card">
                              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <span className="execution-live-dot" />
                                  {liveStage}
                                </span>
                                <span>{liveProgress}%</span>
                              </div>
                              <div className="mb-2 execution-flow-track">
                                <span className="execution-platform-chip">
                                  {sourcePlatformId ? <PlatformIcon platformId={sourcePlatformId} size={14} /> : 'SRC'}
                                </span>
                                <span className="execution-flow-arrow">
                                  <ArrowRight size={14} />
                                </span>
                                <span className="execution-platform-chip">
                                  {targetPlatformId ? <PlatformIcon platformId={targetPlatformId} size={14} /> : 'DST'}
                                </span>
                              </div>
                              <div className="execution-progress-track">
                                <div
                                  className="execution-progress-fill"
                                  style={{ width: `${liveProgress}%` }}
                                />
                                <div className="execution-progress-indeterminate" />
                              </div>
                              <div className="mt-3 space-y-1.5">
                                {steps.map((step) => (
                                  <div key={step.id} className="flex items-center gap-2 text-xs">
                                    <span
                                      className={cn(
                                        'h-2.5 w-2.5 shrink-0 rounded-full border',
                                        step.state === 'done' && 'border-primary/35 bg-primary',
                                        step.state === 'active' && 'border-accent/50 bg-accent animate-pulse',
                                        step.state === 'pending' && 'border-border/75 bg-transparent',
                                        step.state === 'failed' && 'border-destructive/45 bg-destructive'
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'truncate',
                                        step.state === 'done' && 'text-foreground',
                                        step.state === 'active' && 'text-accent-foreground',
                                        step.state === 'pending' && 'text-muted-foreground',
                                        step.state === 'failed' && 'text-destructive'
                                      )}
                                    >
                                      {step.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 sm:ml-4 sm:self-start">
                          <ChevronDown
                            size={20}
                            className={`transition-transform text-muted-foreground ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 space-y-4 border-t border-border pt-6">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs text-muted-foreground">Source Accounts</p>
                              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                {sourceLabels.map((label) => (
                                  <span
                                    key={`${groupId}:source:${label}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-2 py-1"
                                  >
                                    {sourcePlatformId ? <PlatformIcon platformId={sourcePlatformId} size={14} /> : null}
                                    <span>{label}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="mb-1 text-xs text-muted-foreground">Target Accounts</p>
                              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                {targetLabels.map((label) => (
                                  <span
                                    key={`${groupId}:target:${label}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/60 px-2 py-1"
                                  >
                                    {targetPlatformId ? <PlatformIcon platformId={targetPlatformId} size={14} /> : null}
                                    <span>{label}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-xs text-muted-foreground">Message Processing Steps</p>
                            <div className="space-y-1.5 rounded-lg border border-border/65 bg-card/65 p-3">
                              {steps.map((step) => (
                                <div key={`${groupId}-${step.id}`} className="flex items-center gap-2 text-xs">
                                  <span
                                    className={cn(
                                      'h-2.5 w-2.5 shrink-0 rounded-full border',
                                      step.state === 'done' && 'border-primary/35 bg-primary',
                                      step.state === 'active' && 'border-accent/50 bg-accent animate-pulse',
                                      step.state === 'pending' && 'border-border/75 bg-transparent',
                                      step.state === 'failed' && 'border-destructive/45 bg-destructive'
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      'truncate',
                                      step.state === 'done' && 'text-foreground',
                                      step.state === 'active' && 'text-accent-foreground',
                                      step.state === 'pending' && 'text-muted-foreground',
                                      step.state === 'failed' && 'text-destructive'
                                    )}
                                  >
                                    {step.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <p className="mb-1 text-xs text-muted-foreground">Status</p>
                              <p
                                className={`text-sm font-semibold ${
                                  hasPending
                                    ? 'text-secondary-foreground'
                                    : hasFailed
                                      ? 'text-destructive'
                                      : 'text-primary'
                                }`}
                              >
                                {statusText}
                              </p>
                            </div>
                            <div>
                              <p className="mb-1 text-xs text-muted-foreground">Error Reason</p>
                              <p className="text-sm text-foreground">
                                {hasPending
                                  ? 'Execution is still processing. Error details will appear only if one of the routes fails.'
                                  : groupErrors[0] || 'No error'}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 text-xs text-muted-foreground">Routes in this run</p>
                            <div className="space-y-2">
                              {routes.map((route, index) => {
                                const routeSourceLabel =
                                  route.sourceAccountName || route.sourceAccount || 'Unknown source';
                                const routeTargetLabel =
                                  route.targetAccountName || route.targetAccount || 'Unknown target';
                                const routeStatusText =
                                  route.status === 'success'
                                    ? 'Success'
                                    : route.status === 'failed'
                                      ? 'Failed'
                                      : 'Processing';
                                const routeStatusClass =
                                  route.status === 'success'
                                    ? 'border border-primary/30 bg-primary/10 text-primary'
                                    : route.status === 'failed'
                                      ? 'border border-destructive/35 bg-destructive/10 text-destructive'
                                      : 'border border-secondary/35 bg-secondary/20 text-secondary-foreground';
                                const routeLinks = extractExecutionMessageLinks(route.responseData);

                                return (
                                  <div
                                    key={route.id}
                                    className="rounded-lg border border-border/65 bg-card/55 p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs text-muted-foreground">Route {index + 1}</span>
                                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${routeStatusClass}`}>
                                        {routeStatusText}
                                      </span>
                                    </div>
                                    <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-border/65 bg-card/70 px-2.5 py-1 text-xs text-foreground">
                                      <span className="max-w-[170px] truncate">{routeSourceLabel}</span>
                                      <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
                                      <span className="max-w-[170px] truncate">{routeTargetLabel}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      {routeLinks.sourceUrl ? (
                                        <a
                                          href={routeLinks.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          onClick={(event) => event.stopPropagation()}
                                          className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-primary hover:bg-accent"
                                        >
                                          Open Source
                                        </a>
                                      ) : null}
                                      {routeLinks.targetUrl ? (
                                        <a
                                          href={routeLinks.targetUrl}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                          onClick={(event) => event.stopPropagation()}
                                          className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-primary hover:bg-accent"
                                        >
                                          Open Target
                                        </a>
                                      ) : null}
                                      {!routeLinks.sourceUrl && !routeLinks.targetUrl ? (
                                        <span className="text-[11px] text-muted-foreground">No links available</span>
                                      ) : null}
                                    </div>
                                    {route.status === 'failed' && route.error ? (
                                      <p className="mt-2 text-xs text-destructive">{route.error}</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {hasFailed && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRetryTask(lead.taskId);
                                }}
                                disabled={retryingTaskId === lead.taskId || hasPending}
                              >
                                {retryingTaskId === lead.taskId ? 'Retrying...' : 'Retry Task Now'}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Fragment>
              );
            })}
          </div>
        )}
        {hasMore && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
