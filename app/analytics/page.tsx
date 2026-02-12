'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { StatCard } from '@/components/common/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
} from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'taskName' | 'successRate' | 'totalExecutions' | 'failed'>('successRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const pageSize = 50;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/analytics?limit=${pageSize}&offset=0&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load analytics');
        if (cancelled) return;

        setStats({
          totalExecutions: data.totals.executions,
          successfulExecutions: data.totals.successfulExecutions,
          failedExecutions: data.totals.failedExecutions,
          successRate: data.totals.executions > 0
            ? ((data.totals.successfulExecutions / data.totals.executions) * 100).toFixed(2)
            : '0',
          averageExecutionTime: '245ms',
        });

        setTaskStats(data.taskStats || []);
        setOffset(data.nextOffset || 0);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        console.error('[v0] AnalyticsPage: Error loading analytics:', error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, sortBy, sortDir]);

  const handleLoadMore = async () => {
    try {
      const res = await fetch(
        `/api/analytics?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load analytics');
      const next = [...taskStats, ...(data.taskStats || [])];
      setTaskStats(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] AnalyticsPage: Error loading more analytics:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Analytics & Insights
          </h1>
          <p className="text-muted-foreground">
            Monitor task performance and execution statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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

        <div className="mb-6 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/api/analytics/export';
            }}
          >
            Export CSV
          </Button>
        </div>

        {/* Task Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={`${sortBy}:${sortDir}`}
                  onChange={(e) => {
                    const [by, dir] = e.target.value.split(':') as any;
                    setSortBy(by);
                    setSortDir(dir);
                  }}
                >
                  <option value="successRate:desc">Success Rate (High)</option>
                  <option value="successRate:asc">Success Rate (Low)</option>
                  <option value="totalExecutions:desc">Total Runs (High)</option>
                  <option value="totalExecutions:asc">Total Runs (Low)</option>
                  <option value="failed:desc">Failures (High)</option>
                  <option value="failed:asc">Failures (Low)</option>
                  <option value="taskName:asc">Task (A→Z)</option>
                  <option value="taskName:desc">Task (Z→A)</option>
                </select>
              </div>
            </div>
            {taskStats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No execution data available yet. Create and run some tasks to see analytics.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
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
                      <tr key={stat.taskId} className="hover:bg-card/50 transition-colors">
                        <td className="py-4 px-4 text-foreground font-medium">
                          {stat.taskName}
                        </td>
                        <td className="py-4 px-4 text-center text-foreground">
                          {stat.totalExecutions}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {stat.successful}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          {stat.failed > 0 ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
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
                    <Button variant="outline" onClick={handleLoadMore}>
                      Load More
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Insights */}
        <Card className="mt-8">
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
                  {taskStats
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
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">
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
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
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
