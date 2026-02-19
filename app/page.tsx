'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  Users,
  Zap,
} from 'lucide-react';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/common/stat-card';
import { PlatformIcon } from '@/components/common/platform-icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/i18n/language-provider';
import { cn } from '@/lib/utils';
import type { PlatformId } from '@/lib/platforms/types';

type TaskStatus = 'active' | 'paused' | 'completed' | 'error';
type ExecutionStatus = 'success' | 'failed' | 'pending';

interface DashboardTask {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  sourceAccounts: string[];
  targetAccounts: string[];
  executionCount: number;
  failureCount: number;
  lastExecuted?: string | Date | null;
}

interface DashboardExecution {
  id: string;
  taskId: string;
  taskName: string;
  status: ExecutionStatus;
  executedAt?: string | Date;
  sourceAccountName?: string;
  targetAccountName?: string;
  originalContent?: string;
  error?: string;
}

interface DashboardTaskStat {
  taskId: string;
  taskName: string;
  totalExecutions: number;
  successful: number;
  failed: number;
  successRate: number;
}

interface DashboardAccountLite {
  id: string;
  platformId: PlatformId;
  accountName?: string;
  accountUsername?: string;
  isActive: boolean;
}

interface DashboardResponse {
  success: boolean;
  stats: {
    totalTasks: number;
    activeTasksCount: number;
    pausedTasksCount: number;
    errorTasksCount: number;
    completedTasksCount: number;
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    executionSuccessRate: number;
  };
  taskBreakdown: {
    active: number;
    paused: number;
    error: number;
    completed: number;
  };
  accountBreakdown: {
    total: number;
    active: number;
    inactive: number;
    byPlatform: Record<string, number>;
  };
  health: {
    hasFailures: boolean;
    hasAuthWarnings: boolean;
  };
  accountsById: Record<string, DashboardAccountLite>;
  recentTasks: DashboardTask[];
  recentExecutions: DashboardExecution[];
  topTaskStats: DashboardTaskStat[];
}

function getRelativeTime(value?: string | Date | null): string {
  if (!value) return 'Never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return 'Never';

  const delta = Date.now() - date.getTime();
  if (delta < 60_000) return 'Just now';
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function normalizeTaskStatus(rawStatus: unknown): TaskStatus {
  const value = String(rawStatus || '').trim().toLowerCase();
  if (value === 'active' || value === 'enabled' || value === 'running') return 'active';
  if (value === 'paused' || value === 'inactive' || value === 'disabled') return 'paused';
  if (value === 'completed' || value === 'done' || value === 'success') return 'completed';
  if (value === 'error' || value === 'failed' || value === 'failure') return 'error';
  return 'paused';
}

function statusPillClass(status: TaskStatus): string {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'active') return 'status-pill--success';
  if (normalized === 'error') return 'status-pill--error';
  if (normalized === 'completed') return 'status-pill--info';
  return 'status-pill--warning';
}

function statusLabel(status: TaskStatus): string {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'active') return 'Active';
  if (normalized === 'paused') return 'Disabled';
  if (normalized === 'completed') return 'Completed';
  return 'Error';
}

function executionPillClass(status: ExecutionStatus): string {
  if (status === 'success') return 'status-pill--success';
  if (status === 'failed') return 'status-pill--error';
  return 'status-pill--warning';
}

function uniqueTaskPlatforms(accountIds: string[], accountsById: Record<string, DashboardAccountLite>): PlatformId[] {
  const seen = new Set<PlatformId>();
  for (const accountId of accountIds) {
    const platform = accountsById[accountId]?.platformId;
    if (platform) seen.add(platform);
  }
  return [...seen];
}

function getExecutionContentPreview(content?: string): string {
  const text = String(content || '').trim();
  if (!text) return 'No text content';
  return text;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskActionState, setTaskActionState] = useState<Record<string, 'toggle' | 'run' | undefined>>({});

  const fetchDashboard = async (opts: { silent?: boolean } = {}) => {
    const silent = opts.silent === true;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const res = await fetch('/api/dashboard?limit=12', { cache: 'no-store' });
      const data = (await res.json()) as DashboardResponse;
      if (!res.ok || !data.success) {
        throw new Error((data as any)?.error || 'Failed to load dashboard');
      }
      const normalizedRecentTasks = Array.isArray(data.recentTasks)
        ? data.recentTasks.map((task) => ({
            ...task,
            status: normalizeTaskStatus(task.status),
          }))
        : [];
      setDashboard({
        ...data,
        recentTasks: normalizedRecentTasks,
      });
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard';
      setError(message);
      if (!silent) toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (disposed) return;
      await fetchDashboard();
    };

    void load();

    const timer = window.setInterval(() => {
      if (disposed) return;
      void fetchDashboard({ silent: true });
    }, 30_000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleToggleTask = async (task: DashboardTask) => {
    if (taskActionState[task.id]) return;
    const previousStatus = normalizeTaskStatus(task.status);
    const newStatus: TaskStatus = previousStatus === 'active' ? 'paused' : 'active';
    setDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        recentTasks: prev.recentTasks.map((item) =>
          item.id === task.id ? { ...item, status: newStatus } : item
        ),
      };
    });
    setTaskActionState((prev) => ({ ...prev, [task.id]: 'toggle' }));

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
      toast.success(newStatus === 'active' ? 'Task enabled' : 'Task paused');
      await fetchDashboard({ silent: true });
    } catch (actionError) {
      setDashboard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentTasks: prev.recentTasks.map((item) =>
            item.id === task.id ? { ...item, status: previousStatus } : item
          ),
        };
      });
      toast.error(actionError instanceof Error ? actionError.message : 'Failed to update task');
    } finally {
      setTaskActionState((prev) => ({ ...prev, [task.id]: undefined }));
    }
  };

  const handleRunTask = async (task: DashboardTask) => {
    if (taskActionState[task.id]) return;
    setTaskActionState((prev) => ({ ...prev, [task.id]: 'run' }));

    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to run task');
      toast.success('Task run queued');
      await fetchDashboard({ silent: true });
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Failed to run task');
    } finally {
      setTaskActionState((prev) => ({ ...prev, [task.id]: undefined }));
    }
  };

  const stats = dashboard?.stats;
  const accountsById = dashboard?.accountsById || {};
  const recentTasks = dashboard?.recentTasks || [];
  const recentExecutions = dashboard?.recentExecutions || [];
  const topTaskStats = dashboard?.topTaskStats || [];

  const platformBreakdown = useMemo(() => {
    return Object.entries(dashboard?.accountBreakdown?.byPlatform || {}).sort((a, b) => b[1] - a[1]);
  }, [dashboard?.accountBreakdown?.byPlatform]);

  const isEmptyWorkspace =
    !isLoading &&
    !!stats &&
    stats.totalTasks === 0 &&
    stats.totalAccounts === 0 &&
    stats.totalExecutions === 0;

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Zap size={12} />
              Live Operations
            </p>
            <h1 className="page-title">{t('dashboard.welcomeTitle', 'SocialFlow Dashboard')}</h1>
            <p className="page-subtitle">
              Unified control center for tasks, accounts, executions, and operational health.
            </p>

            {stats ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="kpi-pill">{stats.activeTasksCount} active</span>
                <span className="kpi-pill">{stats.pausedTasksCount} paused</span>
                <span className="kpi-pill">{stats.errorTasksCount} errors</span>
                <span className="kpi-pill">{stats.executionSuccessRate}% success rate</span>
                {dashboard?.health?.hasAuthWarnings ? (
                  <span className="kpi-pill border-secondary/45 bg-secondary/24 text-secondary-foreground">
                    OAuth attention needed
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void fetchDashboard()} disabled={isLoading || isRefreshing}>
              <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/accounts">
                <Users size={16} />
                Connect Account
              </Link>
            </Button>
            <Button asChild size="lg" className="animate-float-soft">
              <Link href="/tasks/new">
                <Plus size={18} />
                Create New Task
              </Link>
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="mb-4 border-destructive/35 bg-destructive/10 surface-card">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="inline-flex items-center gap-2 text-destructive">
                <AlertTriangle size={16} />
                <span className="text-sm font-semibold">{error}</span>
              </div>
              <Button size="sm" variant="outline" onClick={() => void fetchDashboard()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {isLoading ? (
          <div className="space-y-4 animate-fade-up">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Card key={index} className="surface-card">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 w-24 rounded bg-muted/60" />
                      <div className="h-8 w-20 rounded bg-muted/40" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="surface-card">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-48 rounded bg-muted/60" />
                  <div className="h-4 w-full rounded bg-muted/40" />
                  <div className="h-4 w-4/5 rounded bg-muted/30" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : isEmptyWorkspace ? (
          <Card className="animate-fade-up surface-card">
            <CardContent className="py-16 text-center">
              <h2 className="text-xl font-bold text-foreground">Workspace is ready</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Connect your first account and create your first automation to see live dashboard insights.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2">
                <Button asChild variant="outline">
                  <Link href="/accounts">Connect Account</Link>
                </Button>
                <Button asChild>
                  <Link href="/tasks/new">Create First Task</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Total Tasks" value={stats?.totalTasks || 0} icon={Zap} color="primary" />
              <StatCard title="Active Tasks" value={stats?.activeTasksCount || 0} icon={PlayCircle} color="secondary" />
              <StatCard title="Connected Accounts" value={stats?.totalAccounts || 0} icon={Users} color="accent" />
              <StatCard
                title="Execution Success"
                value={`${stats?.executionSuccessRate || 0}%`}
                icon={BarChart3}
                color="primary"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card className="surface-card xl:col-span-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-lg font-semibold">
                    <span>Recent Automations</span>
                    <Link href="/tasks" className="text-sm font-semibold text-primary hover:underline">
                      View all
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks yet.</p>
                  ) : (
                    recentTasks.slice(0, 6).map((task) => {
                      const normalizedStatus = normalizeTaskStatus(task.status);
                      const sourcePlatforms = uniqueTaskPlatforms(task.sourceAccounts, accountsById);
                      const targetPlatforms = uniqueTaskPlatforms(task.targetAccounts, accountsById);
                      const isBusy = Boolean(taskActionState[task.id]);

                      return (
                        <div
                          key={task.id}
                          className="rounded-xl border border-border/70 bg-card/60 p-3 transition-colors hover:bg-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-lg font-semibold text-foreground">{task.name}</p>
                                <span
                                  className={cn(
                                    'rounded-full border px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide',
                                    statusPillClass(normalizedStatus)
                                  )}
                                >
                                  {statusLabel(normalizedStatus)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                Last run: {getRelativeTime(task.lastExecuted)}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                  'h-8 w-8 rounded-lg border',
                                  normalizedStatus === 'active'
                                    ? 'border-secondary/35 bg-secondary/20 text-secondary-foreground hover:bg-secondary/30'
                                    : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                                )}
                                onClick={() => void handleToggleTask(task)}
                                disabled={isBusy}
                                aria-label={normalizedStatus === 'active' ? 'Pause task' : 'Enable task'}
                                title={normalizedStatus === 'active' ? 'Pause task' : 'Enable task'}
                              >
                                {normalizedStatus === 'active' ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
                                onClick={() => void handleRunTask(task)}
                                disabled={isBusy}
                                aria-label="Run task now"
                                title="Run task now"
                              >
                                <Zap size={15} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-lg border border-border/70"
                                aria-label="Edit task"
                                title="Edit task"
                                onClick={() => {
                                  router.push(`/tasks/${task.id}/edit`);
                                }}
                                disabled={isBusy}
                              >
                                <ExternalLink size={14} />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-2 py-1.5">
                            {sourcePlatforms.length > 0 ? (
                              sourcePlatforms.map((platform) => (
                                <span
                                  key={`${task.id}-src-${platform}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card"
                                  title={platform}
                                >
                                  <PlatformIcon platformId={platform} size={14} />
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No source</span>
                            )}
                            <span className="mx-1 text-sm text-muted-foreground">→</span>
                            {targetPlatforms.length > 0 ? (
                              targetPlatforms.map((platform) => (
                                <span
                                  key={`${task.id}-dst-${platform}`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card"
                                  title={platform}
                                >
                                  <PlatformIcon platformId={platform} size={14} />
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No target</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card xl:col-span-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">System Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-sm text-muted-foreground">Task health</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                        Active {dashboard?.taskBreakdown.active || 0}
                      </span>
                      <span className="rounded-md border border-secondary/35 bg-secondary/20 px-2 py-1 text-secondary-foreground">
                        Paused {dashboard?.taskBreakdown.paused || 0}
                      </span>
                      <span className="rounded-md border border-destructive/35 bg-destructive/10 px-2 py-1 text-destructive">
                        Errors {dashboard?.taskBreakdown.error || 0}
                      </span>
                      <span className="rounded-md border border-accent/35 bg-accent/16 px-2 py-1 text-accent-foreground">
                        Done {dashboard?.taskBreakdown.completed || 0}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Account reliability</p>
                      {dashboard?.health?.hasAuthWarnings ? (
                        <ShieldAlert size={14} className="text-secondary-foreground" />
                      ) : (
                        <CheckCircle2 size={14} className="text-primary" />
                      )}
                    </div>
                    <div className="mt-2 text-base font-semibold text-foreground">
                      {stats?.activeAccounts || 0} active / {stats?.totalAccounts || 0} total
                    </div>
                    {(stats?.inactiveAccounts || 0) > 0 ? (
                      <p className="mt-1 text-sm text-secondary-foreground">
                        {stats?.inactiveAccounts} account(s) need re-authentication.
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No authentication issues detected.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                    <p className="text-sm text-muted-foreground">Platforms in use</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {platformBreakdown.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No connected platforms.</span>
                      ) : (
                        platformBreakdown.map(([platform, count]) => (
                          <span
                            key={platform}
                            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-sm"
                          >
                            <PlatformIcon platformId={platform as PlatformId} size={14} />
                            {count}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card className="surface-card xl:col-span-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-lg font-semibold">
                    <span>Recent Executions</span>
                    <Link href="/executions" className="text-sm font-semibold text-primary hover:underline">
                      View all
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentExecutions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No executions yet.</p>
                  ) : (
                    recentExecutions.slice(0, 7).map((execution) => (
                      <div
                        key={execution.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/executions?taskId=${encodeURIComponent(execution.taskId)}&taskName=${encodeURIComponent(
                              execution.taskName
                            )}`}
                            className="truncate text-base font-semibold text-foreground hover:text-primary"
                          >
                            {execution.taskName}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {execution.sourceAccountName || 'Unknown source'} →{' '}
                            {execution.targetAccountName || 'Unknown target'}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground/80">
                            {getExecutionContentPreview(execution.originalContent)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-sm font-semibold uppercase tracking-wide',
                              executionPillClass(execution.status)
                            )}
                          >
                            {execution.status}
                          </span>
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock3 size={12} />
                            {getRelativeTime(execution.executedAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="surface-card xl:col-span-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Top Performing Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topTaskStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Performance data will appear after executions run.</p>
                  ) : (
                    topTaskStats.map((taskStat) => (
                      <div
                        key={taskStat.taskId}
                        className="rounded-xl border border-border/70 bg-card/60 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-base font-semibold text-foreground">{taskStat.taskName}</p>
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-sm font-semibold',
                              taskStat.successRate >= 90
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : taskStat.successRate >= 70
                                  ? 'border-secondary/35 bg-secondary/20 text-secondary-foreground'
                                  : 'border-destructive/35 bg-destructive/10 text-destructive'
                            )}
                          >
                            {taskStat.successRate}%
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {taskStat.totalExecutions} runs • {taskStat.successful} success • {taskStat.failed} failed
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
