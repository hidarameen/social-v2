'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  SquarePen,
  CirclePlay,
  CirclePause,
  Trash,
  ScrollText,
  ArrowRight,
  ArrowDown,
  Clock3,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConfirmDialog } from '@/components/common/use-confirm-dialog';
import { PlatformIcon } from '@/components/common/platform-icon';

import type { PlatformAccount, Task } from '@/lib/db';
import type { PlatformId } from '@/lib/platforms/types';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { getCachedQuery, setCachedQuery } from '@/lib/client/query-cache';
import { cn } from '@/lib/utils';

const STATUS_META: Record<Task['status'], { label: string; tone: string }> = {
  active: {
    label: 'Active',
    tone: 'status-pill--success',
  },
  paused: {
    label: 'Disabled',
    tone: 'status-pill--neutral',
  },
  completed: {
    label: 'Completed',
    tone: 'status-pill--neutral',
  },
  error: {
    label: 'Error',
    tone: 'status-pill--error',
  },
};

function normalizeTaskStatus(rawStatus: unknown): Task['status'] {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (value === 'active' || value === 'enabled' || value === 'running') return 'active';
  if (value === 'paused' || value === 'inactive' || value === 'disabled') return 'paused';
  if (value === 'completed' || value === 'done' || value === 'success') return 'completed';
  if (value === 'error' || value === 'failed' || value === 'failure') return 'error';
  return 'paused';
}

function getRelativeLastRun(value?: Date | string | null): string {
  if (!value) return 'Never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Never';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getSuccessRate(executionCount?: number, failureCount?: number): number {
  const total = Math.max(0, Number(executionCount || 0));
  const failed = Math.max(0, Number(failureCount || 0));
  if (total <= 0) return 100;
  const successful = Math.max(0, total - failed);
  return Math.round((successful / total) * 100);
}

const PLATFORM_LABELS: Record<PlatformId, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  pinterest: 'Pinterest',
  google_business: 'Google Business',
  threads: 'Threads',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
};

function uniquePlatformIdsForTask(task: Task, accountById: Record<string, PlatformAccount>): PlatformId[] {
  const seen = new Set<PlatformId>();
  for (const accountId of [...task.sourceAccounts, ...task.targetAccounts]) {
    const platformId = accountById[accountId]?.platformId as PlatformId | undefined;
    if (platformId) seen.add(platformId);
  }
  return [...seen];
}

function taskHasAuthWarning(task: Task, accountById: Record<string, PlatformAccount>): boolean {
  for (const accountId of [...task.sourceAccounts, ...task.targetAccounts]) {
    const account = accountById[accountId];
    if (account && !account.isActive) return true;
  }
  return false;
}

function normalizeAccountMap(raw: unknown): Record<string, PlatformAccount> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  const normalized: Record<string, PlatformAccount> = {};
  for (const [accountId, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    normalized[accountId] = value as PlatformAccount;
  }
  return normalized;
}

function TasksPageContent() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'error'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [lastRunFilter, setLastRunFilter] = useState<'all' | '24h' | '7d' | 'never'>('all');
  const [issueFilter, setIssueFilter] = useState<'all' | 'errors' | 'warnings'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'status' | 'name'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [accountById, setAccountById] = useState<Record<string, PlatformAccount>>({});

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [taskActionState, setTaskActionState] = useState<Record<string, 'toggle' | 'delete' | undefined>>({});

  const pageSize = 50;
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const cacheKey = `tasks:list:${pageSize}:0:${debouncedSearchTerm}:${statusFilter}:${sortBy}:${sortDir}`;
    const cached = getCachedQuery<{
      tasks: Task[];
      accountsById?: Record<string, PlatformAccount>;
      nextOffset: number;
      hasMore: boolean;
    }>(cacheKey, 20_000);

    if (cached) {
      setTasks(cached.tasks);
      setFilteredTasks(cached.tasks);
      setOffset(cached.nextOffset);
      setHasMore(cached.hasMore);
      if (cached.accountsById) {
        setAccountById(cached.accountsById);
      }
      setIsLoadingTasks(false);
    } else {
      setIsLoadingTasks(true);
    }

    async function load() {
      try {
        const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
        const res = await fetch(
          `/api/tasks?limit=${pageSize}&offset=0&search=${encodeURIComponent(debouncedSearchTerm)}${statusParam}&sortBy=${sortBy}&sortDir=${sortDir}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load tasks');
        if (cancelled) return;

        const list = ((data.tasks || []) as Task[]).map((task) => ({
          ...task,
          status: normalizeTaskStatus((task as any)?.status),
        }));
        const nextAccountMap = normalizeAccountMap(data.accountsById);
        const nextOffset = data.nextOffset || 0;
        const nextHasMore = Boolean(data.hasMore);

        setTasks(list);
        setFilteredTasks(list);
        if (Object.keys(nextAccountMap).length > 0) {
          setAccountById(nextAccountMap);
        }
        setOffset(nextOffset);
        setHasMore(nextHasMore);
        setCachedQuery(cacheKey, {
          tasks: list,
          accountsById: nextAccountMap,
          nextOffset,
          hasMore: nextHasMore,
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[TasksPage] Error loading tasks:', error);
      } finally {
        if (!cancelled) setIsLoadingTasks(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pageSize, debouncedSearchTerm, statusFilter, sortBy, sortDir]);

  useEffect(() => {
    const now = Date.now();
    const next = tasks.filter((task) => {
      if (platformFilter !== 'all') {
        const taskPlatforms = uniquePlatformIdsForTask(task, accountById);
        if (!taskPlatforms.includes(platformFilter)) return false;
      }

      if (lastRunFilter === 'never' && task.lastExecuted) return false;
      if (lastRunFilter === '24h') {
        const ts = task.lastExecuted ? new Date(task.lastExecuted).getTime() : 0;
        if (!ts || now - ts > 24 * 60 * 60 * 1000) return false;
      }
      if (lastRunFilter === '7d') {
        const ts = task.lastExecuted ? new Date(task.lastExecuted).getTime() : 0;
        if (!ts || now - ts > 7 * 24 * 60 * 60 * 1000) return false;
      }

      if (issueFilter === 'errors' && task.status !== 'error') return false;
      if (issueFilter === 'warnings' && !taskHasAuthWarning(task, accountById)) return false;
      return true;
    });
    setFilteredTasks(next);
  }, [tasks, platformFilter, lastRunFilter, issueFilter, accountById]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const statusParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const res = await fetch(
        `/api/tasks?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearchTerm)}${statusParam}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load tasks');
      const next = [
        ...tasks,
        ...((data.tasks || []) as Task[]).map((task) => ({
          ...task,
          status: normalizeTaskStatus((task as any)?.status),
        })),
      ];
      const nextAccountMap = normalizeAccountMap(data.accountsById);
      setTasks(next);
      setFilteredTasks(next);
      if (Object.keys(nextAccountMap).length > 0) {
        setAccountById((prev) => ({ ...prev, ...nextAccountMap }));
      }
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[TasksPage] Error loading more tasks:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (taskActionState[taskId]) return;
    const accepted = await confirm({
      title: 'Delete Task?',
      description: 'This action is permanent and cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!accepted) return;

    setTaskActionState((prev) => ({ ...prev, [taskId]: 'delete' }));
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete task');
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete task');
    } finally {
      setTaskActionState((prev) => ({ ...prev, [taskId]: undefined }));
    }
  };

  const handleToggleStatus = async (task: Task) => {
    if (taskActionState[task.id]) return;
    const currentStatus = normalizeTaskStatus(task.status);
    const previousStatus = currentStatus;
    const newStatus: Task['status'] = currentStatus === 'active' ? 'paused' : 'active';
    const applyStatus = (status: Task['status']) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
      setFilteredTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));
    };

    // Optimistic UI for instant feedback.
    applyStatus(newStatus);
    setTaskActionState((prev) => ({ ...prev, [task.id]: 'toggle' }));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
      const serverStatus = normalizeTaskStatus(data?.task?.status || newStatus);
      applyStatus(serverStatus);
      toast.success(newStatus === 'active' ? 'Task resumed' : 'Task paused');
    } catch (error) {
      // Revert optimistic state when request fails.
      applyStatus(previousStatus);
      toast.error(error instanceof Error ? error.message : 'Failed to update task');
    } finally {
      setTaskActionState((prev) => ({ ...prev, [task.id]: undefined }));
    }
  };
  const availablePlatformFilters = [...new Set(tasks.flatMap((task) => uniquePlatformIdsForTask(task, accountById)))]
    .filter(Boolean)
    .sort() as PlatformId[];

  const activeTasksCount = filteredTasks.filter((task) => task.status === 'active').length;
  const pausedTasksCount = filteredTasks.filter((task) => task.status === 'paused').length;
  const erroredTasksCount = filteredTasks.filter((task) => task.status === 'error').length;
  const isInitialLoading = isLoadingTasks && tasks.length === 0;

  return (
    <div className="min-h-screen bg-background control-app dashboard-shell-bg">
      <Sidebar />
      <Header />

      <main className="control-main premium-main">
        <div className="page-header premium-page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Automation Pipelines
            </p>
            <h1 className="page-title">My Tasks</h1>
            <p className="page-subtitle">Manage and monitor your automation tasks</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {isInitialLoading ? (
                <>
                  <span className="kpi-pill">Loading tasks...</span>
                  <span className="kpi-pill">Loading active...</span>
                  <span className="kpi-pill">Loading failed...</span>
                </>
              ) : (
                <>
                  <span className="kpi-pill">{activeTasksCount} active</span>
                  <span className="kpi-pill">{pausedTasksCount} paused</span>
                  <span className="kpi-pill">{erroredTasksCount} failed</span>
                  <span className="kpi-pill">{filteredTasks.length} tasks</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => (window.location.href = '/api/tasks/export')}>
              Export CSV
            </Button>
            <Button size="lg" className="animate-float-soft" onClick={() => router.push('/tasks/new')}>
              <Plus size={18} />
              Create New Task
            </Button>
          </div>
        </div>

        <Card className="mb-6 animate-fade-up sticky-toolbar surface-card">
          <CardHeader>
            <CardTitle>Task Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="equal-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={(value: any) => setPlatformFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All platforms</SelectItem>
                  {availablePlatformFilters.map((platformId) => (
                    <SelectItem key={platformId} value={platformId}>
                      {PLATFORM_LABELS[platformId] || platformId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={lastRunFilter} onValueChange={(value: any) => setLastRunFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Last run" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any run</SelectItem>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7d</SelectItem>
                  <SelectItem value="never">Never ran</SelectItem>
                </SelectContent>
              </Select>
              <Select value={issueFilter} onValueChange={(value: any) => setIssueFilter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Issues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tasks</SelectItem>
                  <SelectItem value="errors">Errors only</SelectItem>
                  <SelectItem value="warnings">Auth warnings</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={`${sortBy}:${sortDir}`}
                onValueChange={(value: string) => {
                  const [by, dir] = value.split(':') as any;
                  setSortBy(by);
                  setSortDir(dir);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt:desc">Date (Newest)</SelectItem>
                  <SelectItem value="createdAt:asc">Date (Oldest)</SelectItem>
                  <SelectItem value="status:asc">Status (A→Z)</SelectItem>
                  <SelectItem value="status:desc">Status (Z→A)</SelectItem>
                  <SelectItem value="name:asc">Name (A→Z)</SelectItem>
                  <SelectItem value="name:desc">Name (Z→A)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(searchTerm ||
                statusFilter !== 'all' ||
                platformFilter !== 'all' ||
                lastRunFilter !== 'all' ||
                issueFilter !== 'all') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setPlatformFilter('all');
                    setLastRunFilter('all');
                    setIssueFilter('all');
                    setSortBy('createdAt');
                    setSortDir('desc');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isInitialLoading ? (
          <div className="space-y-4 animate-fade-up-delay">
            {[0, 1, 2].map((idx) => (
              <Card key={idx} className="surface-card">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 w-48 rounded bg-muted/60" />
                    <div className="h-4 w-80 rounded bg-muted/50" />
                    <div className="h-4 w-64 rounded bg-muted/40" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="animate-fade-up-delay surface-card">
            <CardContent className="py-12 text-center">
              <p className="mb-4 text-muted-foreground">
                No tasks found. {tasks.length === 0 ? 'Create your first task to get started.' : 'Try a different search.'}
              </p>
              {tasks.length === 0 && (
                <Button onClick={() => router.push('/tasks/new')}>
                  <Plus size={18} className="mr-2" />
                  Create Your First Task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="equal-grid grid grid-cols-1 gap-3 xl:grid-cols-2">
              {filteredTasks.map((task) => {
                const normalizedStatus = normalizeTaskStatus(task.status);
                const statusMeta = STATUS_META[normalizedStatus] || STATUS_META.paused;
                const isActionBusy = Boolean(taskActionState[task.id]);
                const routeCount =
                  Math.max(1, task.sourceAccounts.length) * Math.max(1, task.targetAccounts.length);
                const sourceNodes = task.sourceAccounts
                  .map((id) => accountById[id])
                  .filter(Boolean)
                  .map((account) => ({
                    id: account.id,
                    platformId: account.platformId as PlatformId,
                  }));
                const targetNodes = task.targetAccounts
                  .map((id) => accountById[id])
                  .filter(Boolean)
                  .map((account) => ({
                    id: account.id,
                    platformId: account.platformId as PlatformId,
                  }));
                const sourceVisibleNodes = sourceNodes;
                const targetVisibleNodes = targetNodes;
                const successRate = getSuccessRate(task.executionCount, task.failureCount);
                const lastRunLabel = getRelativeLastRun(task.lastExecuted);
                const hasAuthWarning = taskHasAuthWarning(task, accountById);
                const baseDescription = String(task.description || '').trim();
                const descriptionText =
                  normalizedStatus === 'error'
                    ? `Error: ${String(task.lastError || '').trim() || 'Failed to fetch data'}`
                    : baseDescription;
                const showDescription = normalizedStatus === 'error' || baseDescription.length > 0;
                const statusBadgeClass =
                  normalizedStatus === 'active'
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : normalizedStatus === 'error'
                      ? 'bg-destructive/10 text-destructive border-destructive/35'
                      : 'bg-secondary/20 text-secondary-foreground border-secondary/35';

                return (
                  <Card
                    key={task.id}
                    className="surface-card animate-fade-up overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-foreground/10"
                  >
                    <CardContent className="p-3 sm:p-3.5">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className={cn('rounded-full border px-2.5 py-1 text-sm font-black uppercase tracking-[0.14em]', statusBadgeClass)}>
                                {statusMeta.label}
                              </span>
                              <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-sm font-semibold text-muted-foreground">
                                Success {successRate}%
                              </span>
                              {hasAuthWarning ? (
                                <span className="rounded-full border border-secondary/40 bg-secondary/24 px-2 py-0.5 text-sm font-medium text-secondary-foreground">
                                  OAuth Warning
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{task.name}</h3>
                                {showDescription ? (
                                  <p className={cn('mt-0.5 line-clamp-2 text-base font-medium text-muted-foreground', normalizedStatus === 'error' && 'inline-flex items-center gap-1.5 text-destructive')}>
                                    {normalizedStatus === 'error' ? <AlertTriangle size={14} /> : null}
                                    <span>{descriptionText}</span>
                                  </p>
                                ) : null}
                              </div>
                              <div className="ml-1 inline-flex shrink-0 items-center gap-2">
                                <Button
                                  variant="ghost"
                                  className={cn(
                                    'h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-muted-foreground shadow-none transition-all duration-150 hover:bg-transparent hover:text-foreground',
                                    normalizedStatus === 'active'
                                      ? 'text-secondary-foreground hover:text-secondary-foreground'
                                      : 'text-primary hover:text-primary'
                                  )}
                                  onClick={() => handleToggleStatus(task)}
                                  title={normalizedStatus === 'active' ? 'Disable task' : 'Enable task'}
                                  aria-label={normalizedStatus === 'active' ? 'Disable task' : 'Enable task'}
                                  disabled={isActionBusy}
                                >
                                  {normalizedStatus === 'active' ? <CirclePause size={21} /> : <CirclePlay size={21} />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-muted-foreground shadow-none transition-all duration-150 hover:bg-transparent hover:text-primary"
                                  onClick={() => router.push(`/tasks/${task.id}/edit`)}
                                  title="Edit task"
                                  aria-label="Edit task"
                                  disabled={isActionBusy}
                                >
                                  <SquarePen size={19} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-muted-foreground shadow-none transition-all duration-150 hover:bg-transparent hover:text-foreground"
                                  onClick={() =>
                                    router.push(
                                      `/executions?taskId=${encodeURIComponent(task.id)}&taskName=${encodeURIComponent(task.name)}`
                                    )
                                  }
                                  title="View logs"
                                  aria-label="View logs"
                                  disabled={isActionBusy}
                                >
                                  <ScrollText size={19} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-10 w-10 rounded-lg border-0 bg-transparent p-0 text-muted-foreground shadow-none transition-all duration-150 hover:bg-transparent hover:text-destructive"
                                  onClick={() => void handleDelete(task.id)}
                                  title="Delete task"
                                  aria-label="Delete task"
                                  disabled={isActionBusy}
                                >
                                  <Trash size={19} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-muted/35 p-2 md:flex-row">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2 py-1.5 shadow-sm">
                            {sourceVisibleNodes.length > 0 ? (
                              sourceVisibleNodes.map((node, index) => (
                                <span key={`${task.id}-source-${node.id}`} className="inline-flex min-w-0 items-center gap-1.5">
                                  {index > 0 ? <span className="text-muted-foreground/60">+</span> : null}
                                  <span
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card"
                                    title={PLATFORM_LABELS[node.platformId] || node.platformId}
                                  >
                                    <PlatformIcon platformId={node.platformId} size={17} />
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No source</span>
                            )}
                          </div>

                          <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground/70 md:inline-flex">
                            <ArrowRight size={13} />
                          </span>
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground/70 md:hidden">
                            <ArrowDown size={13} />
                          </span>

                          <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2 py-1.5 shadow-sm">
                            {targetVisibleNodes.length > 0 ? (
                              targetVisibleNodes.map((node, index) => (
                                <span key={`${task.id}-target-${node.id}`} className="inline-flex min-w-0 items-center gap-1.5">
                                  {index > 0 ? <span className="text-muted-foreground/60">+</span> : null}
                                  <span
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-card"
                                    title={PLATFORM_LABELS[node.platformId] || node.platformId}
                                  >
                                    <PlatformIcon platformId={node.platformId} size={17} />
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No target</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                            <span className="rounded-full border border-border/70 bg-background px-1.5 py-0.5">
                              Accounts: {task.sourceAccounts.length + task.targetAccounts.length}
                            </span>
                            <span className="rounded-full border border-border/70 bg-background px-1.5 py-0.5">
                              Transfers: {task.executionCount || 0}
                            </span>
                            <span className="rounded-full border border-border/70 bg-background px-1.5 py-0.5">
                              Routes: {routeCount}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock3 size={13} />
                            <span className="text-sm font-semibold tracking-tight">Last run: {lastRunLabel}</span>
                          </div>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}

        {ConfirmDialog}
      </main>
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="splash-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="splash-overlay__glow" />
          <div className="splash-overlay__panel">
            <div className="splash-overlay__ring" />
            <div className="splash-overlay__logo">
              <Plus size={28} />
            </div>
            <p className="splash-overlay__title">Loading Tasks</p>
            <p className="splash-overlay__subtitle">Preparing task dashboard...</p>
            <div className="splash-overlay__loader" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
