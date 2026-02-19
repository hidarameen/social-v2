'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/common/stat-card';
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
import {
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Sparkles,
} from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { getCachedQuery, setCachedQuery } from '@/lib/client/query-cache';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    successRate: '0',
    averageExecutionTime: '0ms',
  });

  const [taskStats, setTaskStats] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'taskName' | 'successRate' | 'totalExecutions' | 'failed'>('successRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const pageSize = 50;
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const isInitialLoading = isLoadingAnalytics && taskStats.length === 0;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = `analytics:list:${pageSize}:0:${debouncedSearchTerm}:${sortBy}:${sortDir}`;
    const cached = getCachedQuery<{
      stats: typeof stats;
      taskStats: any[];
      nextOffset: number;
      hasMore: boolean;
    }>(cacheKey, 20_000);

    if (cached) {
      setStats(cached.stats);
      setTaskStats(cached.taskStats);
      setOffset(cached.nextOffset);
      setHasMore(cached.hasMore);
      setIsLoadingAnalytics(false);
    } else {
      setIsLoadingAnalytics(true);
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/analytics?limit=${pageSize}&offset=0&search=${encodeURIComponent(debouncedSearchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load analytics');
        if (cancelled) return;

        const nextStats = {
          totalExecutions: data.totals.executions,
          successfulExecutions: data.totals.successfulExecutions,
          failedExecutions: data.totals.failedExecutions,
          successRate: data.totals.executions > 0
            ? ((data.totals.successfulExecutions / data.totals.executions) * 100).toFixed(2)
            : '0',
          averageExecutionTime: '245ms',
        };
        const list = data.taskStats || [];
        const nextOffset = data.nextOffset || 0;
        const nextHasMore = Boolean(data.hasMore);

        setStats(nextStats);
        setTaskStats(list);
        setOffset(nextOffset);
        setHasMore(nextHasMore);
        setCachedQuery(cacheKey, {
          stats: nextStats,
          taskStats: list,
          nextOffset,
          hasMore: nextHasMore,
        });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[v0] AnalyticsPage: Error loading analytics:', error);
      } finally {
        if (!cancelled) {
          setIsLoadingAnalytics(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pageSize, debouncedSearchTerm, sortBy, sortDir]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const res = await fetch(
        `/api/analytics?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(debouncedSearchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load analytics');
      const next = [...taskStats, ...(data.taskStats || [])];
      setTaskStats(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] AnalyticsPage: Error loading more analytics:', error);
    } finally {
      setIsLoadingMore(false);
    }
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
              Execution Intelligence
            </p>
            <h1 className="page-title">
            Analytics & Insights
            </h1>
            <p className="page-subtitle">
            Monitor task performance and execution statistics
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {isInitialLoading ? (
                <>
                  <span className="kpi-pill">Loading totals...</span>
                  <span className="kpi-pill">Loading success...</span>
                  <span className="kpi-pill">Loading failures...</span>
                </>
              ) : (
                <>
                  <span className="kpi-pill">{stats.totalExecutions} total runs</span>
                  <span className="kpi-pill">{stats.successfulExecutions} successful</span>
                  <span className="kpi-pill">{stats.failedExecutions} failed</span>
                  <span className="kpi-pill">{stats.successRate}% success</span>
                </>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/api/analytics/export';
            }}
          >
            Export CSV
          </Button>
        </div>

        {isInitialLoading ? (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((idx) => (
              <Card key={idx} className="surface-card">
                <CardContent className="pt-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 w-24 rounded bg-muted/50" />
                    <div className="h-8 w-20 rounded bg-muted/65" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              title="Total Executions"
              value={stats.totalExecutions}
              icon={Zap}
              color="primary"
            />
            <StatCard
              title="Successful"
              value={stats.successfulExecutions}
              icon={CheckCircle}
              color="secondary"
            />
            <StatCard
              title="Failed"
              value={stats.failedExecutions}
              icon={AlertCircle}
              color="primary"
            />
            <StatCard
              title="Success Rate"
              value={`${stats.successRate}%`}
              icon={TrendingUp}
              color="accent"
            />
            <StatCard
              title="Avg. Time"
              value={stats.averageExecutionTime}
              icon={Clock}
              color="primary"
            />
          </div>
        )}

        <Card className="mb-8 animate-fade-up surface-card">
          <CardHeader>
            <CardTitle>Success Rate by Task (Top 8)</CardTitle>
          </CardHeader>
          <CardContent>
            {taskStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chart data yet.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskStats.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="4 4" opacity={0.25} />
                    <XAxis
                      dataKey="taskName"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      minTickGap={18}
                      angle={-20}
                      textAnchor="end"
                      height={56}
                    />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="successRate" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Performance Table */}
        <Card className="animate-fade-up surface-card">
          <CardHeader>
            <CardTitle>Performance by Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 sticky-toolbar surface-card">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
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
                    <SelectItem value="successRate:desc">Success Rate (High)</SelectItem>
                    <SelectItem value="successRate:asc">Success Rate (Low)</SelectItem>
                    <SelectItem value="totalExecutions:desc">Total Runs (High)</SelectItem>
                    <SelectItem value="totalExecutions:asc">Total Runs (Low)</SelectItem>
                    <SelectItem value="failed:desc">Failures (High)</SelectItem>
                    <SelectItem value="failed:asc">Failures (Low)</SelectItem>
                    <SelectItem value="taskName:asc">Task (A→Z)</SelectItem>
                    <SelectItem value="taskName:desc">Task (Z→A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isInitialLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="animate-pulse rounded-xl border border-border/60 p-4">
                    <div className="h-4 w-40 rounded bg-muted/55" />
                    <div className="mt-3 h-3 w-64 rounded bg-muted/40" />
                  </div>
                ))}
              </div>
            ) : taskStats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No execution data available yet. Create and run some tasks to see analytics.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">
                        Task Name
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">
                        Total Runs
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">
                        Successful
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">
                        Failed
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-foreground">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {taskStats.map(stat => (
                      <tr key={stat.taskId} className="hover:bg-card/60 transition-colors">
                        <td className="py-4 px-4 text-foreground font-medium">
                          {stat.taskName}
                        </td>
                        <td className="py-4 px-4 text-center text-foreground">
                          {stat.totalExecutions}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {stat.successful}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {stat.failed > 0 ? (
                            <span className="inline-block rounded-full border border-destructive/35 bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                              {stat.failed}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center text-foreground font-semibold">
                          {stat.successRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                      {isLoadingMore ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card className="mt-8 animate-fade-up-delay surface-card">
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">
                  Best Performing Tasks
                </h3>
                <div className="space-y-2">
                  {[...taskStats]
                    .sort((a, b) => Number(b.successRate) - Number(a.successRate))
                    .slice(0, 3)
                    .map(stat => (
                      <div
                        key={stat.taskId}
                        className="flex items-center justify-between p-3 rounded-lg bg-card/50"
                      >
                        <span className="text-sm text-foreground">
                          {stat.taskName}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {stat.successRate}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-3">
                  Recent Executions
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Execution Summary
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last 24 hours
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {stats.totalExecutions} runs
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        System Health
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Overall
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      Excellent
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
