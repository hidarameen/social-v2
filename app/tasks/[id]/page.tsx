'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlatformAccount, Task } from '@/lib/db';
import {
  Play,
  Pause,
  Edit2,
  Trash2,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [executions, setExecutions] = useState<any[]>([]);
  const [errorAnalysis, setErrorAnalysis] = useState<any[]>([]);
  const [failurePrediction, setFailurePrediction] = useState<any>(null);
  const [performanceReport, setPerformanceReport] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);

  const toLocalInputValue = (value?: Date | string | null) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/tasks/${taskId}/details`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load task');
        if (cancelled) return;
        setTask(data.task);
        setStats(data.stats);
        setEditForm({
          name: data.task.name,
          description: data.task.description,
          executionType: data.task.executionType,
          scheduleTime: toLocalInputValue(data.task.scheduleTime),
          recurringPattern: data.task.recurringPattern || 'daily',
          template: data.task.transformations?.template || '',
          includeMedia: data.task.transformations?.includeMedia !== false,
          enableYtDlp: data.task.transformations?.enableYtDlp === true,
          twitterActions: data.task.transformations?.twitterActions || {
            post: true,
            reply: false,
            quote: false,
            retweet: false,
            like: false,
          },
          twitterSourceType: data.task.filters?.twitterSourceType || 'account',
          twitterUsername: data.task.filters?.twitterUsername || '',
          excludeReplies: Boolean(data.task.filters?.excludeReplies),
          excludeRetweets: Boolean(data.task.filters?.excludeRetweets),
          excludeQuotes: Boolean(data.task.filters?.excludeQuotes),
          originalOnly: Boolean(data.task.filters?.originalOnly),
          pollIntervalSeconds: Number(data.task.filters?.pollIntervalSeconds || 60),
          triggerType: data.task.filters?.triggerType || 'on_tweet',
          triggerValue: data.task.filters?.triggerValue || '',
        });
        setExecutions(
          (data.executions || []).sort(
            (a: any, b: any) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
          )
        );
        setErrorAnalysis(data.errorAnalysis || []);
        setFailurePrediction(data.failurePrediction || null);
        setPerformanceReport(data.performanceReport || null);
      } catch (error) {
        console.error('[v0] TaskDetail: Error loading task details:', error);
        router.push('/tasks');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [taskId, router]);

  useEffect(() => {
    if (!task || isEditing) return;
    setEditForm({
      name: task.name,
      description: task.description,
      executionType: task.executionType,
      scheduleTime: toLocalInputValue(task.scheduleTime),
      recurringPattern: task.recurringPattern || 'daily',
      template: task.transformations?.template || '',
      includeMedia: task.transformations?.includeMedia !== false,
      enableYtDlp: task.transformations?.enableYtDlp === true,
      twitterActions: task.transformations?.twitterActions || {
        post: true,
        reply: false,
        quote: false,
        retweet: false,
        like: false,
      },
      twitterSourceType: task.filters?.twitterSourceType || 'account',
      twitterUsername: task.filters?.twitterUsername || '',
      excludeReplies: Boolean(task.filters?.excludeReplies),
      excludeRetweets: Boolean(task.filters?.excludeRetweets),
      excludeQuotes: Boolean(task.filters?.excludeQuotes),
      originalOnly: Boolean(task.filters?.originalOnly),
      pollIntervalSeconds: Number(task.filters?.pollIntervalSeconds || 60),
      triggerType: task.filters?.triggerType || 'on_tweet',
      triggerValue: task.filters?.triggerValue || '',
    });
  }, [task, isEditing]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (!cancelled) setAccounts(data.accounts || []);
      } catch (error) {
        console.error('[v0] TaskDetail: Error loading accounts:', error);
      }
    }
    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunTask = async () => {
    if (!task) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to run task');
      alert(`Task executed! ${data.executions.length} transfer(s) completed.`);

      const detailsRes = await fetch(`/api/tasks/${taskId}/details`);
      const details = await detailsRes.json();
      if (detailsRes.ok && details.success) {
        setTask(details.task);
        setStats(details.stats);
        setExecutions(
          (details.executions || []).sort(
            (a: any, b: any) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
          )
        );
      }
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleToggleStatus = () => {
    if (!task) return;

    const newStatus = task.status === 'active' ? 'paused' : 'active';
    fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to update task');
        setTask({ ...task, status: newStatus as any });
      })
      .catch(error => alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  };

  const handleDelete = () => {
    if (confirm('Delete this task? This action cannot be undone.')) {
      fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
          if (!data.success) throw new Error(data.error || 'Failed to delete task');
          router.push('/tasks');
        })
        .catch(error => alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  };

  const handleSaveEdits = async () => {
    if (!editForm) return;
    if (editForm.twitterSourceType === 'username' && !editForm.twitterUsername.trim()) {
      alert('Please enter a Twitter username for the source');
      return;
    }
    if (editForm.triggerType === 'on_like' && editForm.twitterSourceType === 'username') {
      alert('Liked-tweet trigger requires a connected Twitter account');
      return;
    }
    if (
      (editForm.triggerType === 'on_keyword' ||
        editForm.triggerType === 'on_hashtag' ||
        editForm.triggerType === 'on_search') &&
      !editForm.triggerValue.trim()
    ) {
      alert('Please enter a trigger value for the selected trigger type');
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          executionType: editForm.executionType,
          scheduleTime: editForm.scheduleTime ? new Date(editForm.scheduleTime) : undefined,
          recurringPattern: editForm.recurringPattern,
          transformations: {
            template: editForm.template || undefined,
            includeMedia: editForm.includeMedia,
            enableYtDlp: editForm.enableYtDlp,
            twitterActions: editForm.twitterActions,
          },
          filters: {
            twitterSourceType: editForm.twitterSourceType,
            twitterUsername: editForm.twitterUsername.trim() || undefined,
            excludeReplies: editForm.excludeReplies,
            excludeRetweets: editForm.excludeRetweets,
            excludeQuotes: editForm.excludeQuotes,
            originalOnly: editForm.originalOnly,
            pollIntervalSeconds: Number(editForm.pollIntervalSeconds || 60),
            triggerType: editForm.triggerType,
            triggerValue: editForm.triggerValue.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
      setTask(data.task);
      setIsEditing(false);
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (!task || !stats) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <main className="ml-64 mt-16 p-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  const hasTwitterTarget = accounts.some(
    a => task.targetAccounts.includes(a.id) && a.platformId === 'twitter'
  );

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Header />

      <main className="ml-64 mt-16 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {task.name}
            </h1>
            <p className="text-muted-foreground">
              Task ID: {taskId.substring(0, 8)}...
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRunTask} size="lg">
              <Play size={20} className="mr-2" />
              Run Now
            </Button>

            <Button
              variant="outline"
              onClick={handleToggleStatus}
            >
              {task.status === 'active' ? (
                <>
                  <Pause size={18} className="mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play size={18} className="mr-2" />
                  Resume
                </>
              )}
            </Button>

            <Button variant="outline" size="icon" onClick={() => setIsEditing(v => !v)}>
              <Edit2 size={18} />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleDelete}
              className="text-destructive bg-transparent"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        </div>

        {isEditing && editForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Edit Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Task Name
                </label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev: any) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev: any) => ({ ...prev, description: e.target.value }))
                  }
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Execution Type
                </label>
                <Select
                  value={editForm.executionType}
                  onValueChange={(value: any) =>
                    setEditForm((prev: any) => ({ ...prev, executionType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.executionType === 'scheduled' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Schedule Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={editForm.scheduleTime}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, scheduleTime: e.target.value }))
                    }
                  />
                </div>
              )}
              {editForm.executionType === 'recurring' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Recurrence Pattern
                  </label>
                  <Select
                    value={editForm.recurringPattern}
                    onValueChange={(value: any) =>
                      setEditForm((prev: any) => ({ ...prev, recurringPattern: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message Template
                </label>
                <Textarea
                  value={editForm.template}
                  onChange={(e) =>
                    setEditForm((prev: any) => ({ ...prev, template: e.target.value }))
                  }
                  rows={4}
                  placeholder="%name% (@%username%)&#10;%date%&#10;%text%&#10;%link%"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Placeholders: %text%, %username%, %name%, %date%, %link%, %media%
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.includeMedia}
                  onChange={(e) =>
                    setEditForm((prev: any) => ({ ...prev, includeMedia: e.target.checked }))
                  }
                />
                Include images/videos when available
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.enableYtDlp}
                  onChange={(e) =>
                    setEditForm((prev: any) => ({ ...prev, enableYtDlp: e.target.checked }))
                  }
                />
                Download Twitter videos via yt-dlp
              </label>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Twitter Source Type
                </label>
                <Select
                  value={editForm.twitterSourceType}
                  onValueChange={(value: any) =>
                    setEditForm((prev: any) => ({ ...prev, twitterSourceType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">My connected account</SelectItem>
                    <SelectItem value="username">Another user by username</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Trigger Type
                </label>
                <Select
                  value={editForm.triggerType}
                  onValueChange={(value: any) =>
                    setEditForm((prev: any) => ({ ...prev, triggerType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_tweet">New tweet by source</SelectItem>
                    <SelectItem value="on_retweet">New retweet by source</SelectItem>
                    <SelectItem value="on_like">New liked tweet by source</SelectItem>
                    <SelectItem value="on_mention">New mention of source</SelectItem>
                    <SelectItem value="on_search">New tweet from search</SelectItem>
                    <SelectItem value="on_keyword">New tweet with keyword</SelectItem>
                    <SelectItem value="on_hashtag">New tweet with hashtag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editForm.triggerType === 'on_keyword' ||
                editForm.triggerType === 'on_hashtag' ||
                editForm.triggerType === 'on_search') && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Trigger Value
                  </label>
                  <Input
                    value={editForm.triggerValue}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, triggerValue: e.target.value }))
                    }
                  />
                </div>
              )}
              {editForm.twitterSourceType === 'username' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Twitter Username
                  </label>
                  <Input
                    value={editForm.twitterUsername}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, twitterUsername: e.target.value }))
                    }
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Filters
                </label>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Poll Interval (seconds)
                </label>
                <Input
                  type="number"
                  min={10}
                  value={editForm.pollIntervalSeconds}
                  onChange={(e) =>
                    setEditForm((prev: any) => ({
                      ...prev,
                      pollIntervalSeconds: Math.max(10, Number(e.target.value || 10)),
                    }))
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.originalOnly}
                    disabled={editForm.triggerType === 'on_retweet'}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, originalOnly: e.target.checked }))
                    }
                  />
                  Original only (exclude replies/retweets/quotes)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.excludeReplies}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, excludeReplies: e.target.checked }))
                    }
                  />
                  Exclude replies
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.excludeRetweets}
                    disabled={editForm.triggerType === 'on_retweet'}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, excludeRetweets: e.target.checked }))
                    }
                  />
                  Exclude retweets
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.excludeQuotes}
                    onChange={(e) =>
                      setEditForm((prev: any) => ({ ...prev, excludeQuotes: e.target.checked }))
                    }
                  />
                  Exclude quote tweets
                </label>
              </div>

              {hasTwitterTarget && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Twitter Actions
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.twitterActions?.post}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          twitterActions: { ...prev.twitterActions, post: e.target.checked },
                        }))
                      }
                    />
                    Post tweet
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.twitterActions?.reply}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          twitterActions: { ...prev.twitterActions, reply: e.target.checked },
                        }))
                      }
                    />
                    Reply to the source tweet
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.twitterActions?.quote}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          twitterActions: { ...prev.twitterActions, quote: e.target.checked },
                        }))
                      }
                    />
                    Quote tweet
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.twitterActions?.retweet}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          twitterActions: { ...prev.twitterActions, retweet: e.target.checked },
                        }))
                      }
                    />
                    Retweet
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.twitterActions?.like}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          twitterActions: { ...prev.twitterActions, like: e.target.checked },
                        }))
                      }
                    />
                    Like
                  </label>
                  <p className="text-xs text-muted-foreground">
                    If none are selected, a tweet will be posted by default.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleSaveEdits}>Save Changes</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Badge */}
        <div className="mb-8">
          <span
            className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
              task.status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {task.status.toUpperCase()}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Total Executions</p>
              <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Successful</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                {stats.successful}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Failed</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.failed}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Success Rate</p>
              <p className="text-3xl font-bold text-primary">
                {stats.successRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Task Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground">{task.description || 'No description'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Execution Type</p>
                    <p className="text-foreground capitalize">{task.executionType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Content Type</p>
                    <p className="text-foreground capitalize">{task.contentType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Source Accounts</p>
                    <p className="text-foreground font-semibold">
                      {task.sourceAccounts.length} account(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Target Accounts</p>
                    <p className="text-foreground font-semibold">
                      {task.targetAccounts.length} account(s)
                    </p>
                  </div>
                </div>

                {task.scheduleTime && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Scheduled For</p>
                    <p className="text-foreground">
                      {new Date(task.scheduleTime).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Executions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Executions</CardTitle>
              </CardHeader>
              <CardContent>
                {executions.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No executions yet. Run the task to see execution history.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {executions.slice(0, 5).map((exec, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {exec.status === 'success' ? (
                            <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                          )}
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {exec.status === 'success' ? 'Success' : 'Failed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(exec.executedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {exec.error && (
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {exec.error.substring(0, 50)}...
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <div className="space-y-6">
            {/* Performance Report */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap size={18} />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                  <p className="text-lg font-semibold text-foreground">
                    {performanceReport?.uptime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Avg. Time</p>
                  <p className="text-lg font-semibold text-foreground">
                    {performanceReport?.averageExecutionTime}
                  </p>
                </div>
                <div className="pt-3 border-t border-border">
                  {performanceReport?.recommendations.map((rec, idx) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {rec}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Failure Prediction */}
            {failurePrediction && failurePrediction.riskLevel > 0 && (
              <Card className={failurePrediction.riskLevel > 50 ? 'border-destructive' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle size={18} />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Risk Level: {failurePrediction.riskLevel}%
                    </p>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          failurePrediction.riskLevel > 50
                            ? 'bg-destructive'
                            : failurePrediction.riskLevel > 30
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{
                          width: `${failurePrediction.riskLevel}%`,
                        }}
                      />
                    </div>
                  </div>
                  {failurePrediction.factors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Factors:
                      </p>
                      {failurePrediction.factors.map((factor, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          • {factor}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error Analysis */}
            {errorAnalysis.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle size={18} />
                    Error Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {errorAnalysis.map((error, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-card/50 border border-border/50"
                    >
                      <p className="text-sm font-semibold text-foreground mb-1">
                        {error.pattern}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {error.suggestion}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
