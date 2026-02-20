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
  Zap,
  Sparkles,
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/common/use-confirm-dialog';
import { extractYouTubeVideoLinks } from '@/lib/execution-links';
import {
  DEFAULT_YOUTUBE_CATEGORY_ID,
  resolveYouTubeCategoryId,
  YOUTUBE_VIDEO_CATEGORIES,
} from '@/lib/youtube-categories';

export default function TaskDetailPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
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

  const toDateInputValue = (value?: Date | string | null) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
          sourceAccounts: Array.isArray(data.task.sourceAccounts) ? data.task.sourceAccounts : [],
          targetAccounts: Array.isArray(data.task.targetAccounts) ? data.task.targetAccounts : [],
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
          youtubeActions: {
            uploadVideo: data.task.transformations?.youtubeActions?.uploadVideo !== false,
            uploadVideoToPlaylist: data.task.transformations?.youtubeActions?.uploadVideoToPlaylist === true,
            playlistId: data.task.transformations?.youtubeActions?.playlistId || '',
          },
          youtubeVideo: {
            titleTemplate: data.task.transformations?.youtubeVideo?.titleTemplate || '',
            descriptionTemplate: data.task.transformations?.youtubeVideo?.descriptionTemplate || '',
            tagsText: Array.isArray(data.task.transformations?.youtubeVideo?.tags)
              ? data.task.transformations.youtubeVideo.tags.join(', ')
              : '',
            privacyStatus: data.task.transformations?.youtubeVideo?.privacyStatus || 'public',
            categoryId:
              resolveYouTubeCategoryId(data.task.transformations?.youtubeVideo?.categoryId) ||
              DEFAULT_YOUTUBE_CATEGORY_ID,
            embeddable: data.task.transformations?.youtubeVideo?.embeddable !== false,
            license: data.task.transformations?.youtubeVideo?.license || 'youtube',
            publicStatsViewable:
              data.task.transformations?.youtubeVideo?.publicStatsViewable !== false,
            selfDeclaredMadeForKids:
              data.task.transformations?.youtubeVideo?.selfDeclaredMadeForKids === true,
            notifySubscribers: data.task.transformations?.youtubeVideo?.notifySubscribers !== false,
            publishAt: toLocalInputValue(data.task.transformations?.youtubeVideo?.publishAt),
            defaultLanguage: data.task.transformations?.youtubeVideo?.defaultLanguage || '',
            defaultAudioLanguage: data.task.transformations?.youtubeVideo?.defaultAudioLanguage || '',
            recordingDate: toDateInputValue(data.task.transformations?.youtubeVideo?.recordingDate),
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
      sourceAccounts: Array.isArray(task.sourceAccounts) ? task.sourceAccounts : [],
      targetAccounts: Array.isArray(task.targetAccounts) ? task.targetAccounts : [],
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
      youtubeActions: {
        uploadVideo: task.transformations?.youtubeActions?.uploadVideo !== false,
        uploadVideoToPlaylist: task.transformations?.youtubeActions?.uploadVideoToPlaylist === true,
        playlistId: task.transformations?.youtubeActions?.playlistId || '',
      },
      youtubeVideo: {
        titleTemplate: task.transformations?.youtubeVideo?.titleTemplate || '',
        descriptionTemplate: task.transformations?.youtubeVideo?.descriptionTemplate || '',
        tagsText: Array.isArray(task.transformations?.youtubeVideo?.tags)
          ? task.transformations.youtubeVideo.tags.join(', ')
          : '',
        privacyStatus: task.transformations?.youtubeVideo?.privacyStatus || 'public',
        categoryId:
          resolveYouTubeCategoryId(task.transformations?.youtubeVideo?.categoryId) ||
          DEFAULT_YOUTUBE_CATEGORY_ID,
        embeddable: task.transformations?.youtubeVideo?.embeddable !== false,
        license: task.transformations?.youtubeVideo?.license || 'youtube',
        publicStatsViewable: task.transformations?.youtubeVideo?.publicStatsViewable !== false,
        selfDeclaredMadeForKids: task.transformations?.youtubeVideo?.selfDeclaredMadeForKids === true,
        notifySubscribers: task.transformations?.youtubeVideo?.notifySubscribers !== false,
        publishAt: toLocalInputValue(task.transformations?.youtubeVideo?.publishAt),
        defaultLanguage: task.transformations?.youtubeVideo?.defaultLanguage || '',
        defaultAudioLanguage: task.transformations?.youtubeVideo?.defaultAudioLanguage || '',
        recordingDate: toDateInputValue(task.transformations?.youtubeVideo?.recordingDate),
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
        const res = await fetch('/api/accounts?limit=200&offset=0');
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
      toast.success('Task execution queued successfully');

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
      toast.error(error instanceof Error ? error.message : 'Unknown error');
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
        toast.success(newStatus === 'active' ? 'Task resumed' : 'Task paused');
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Unknown error'));
  };

  const handleDelete = async () => {
    const accepted = await confirm({
      title: 'Delete Task?',
      description: 'This action cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!accepted) return;

    fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to delete task');
        toast.success('Task deleted successfully');
        router.push('/tasks');
      })
      .catch(error => toast.error(error instanceof Error ? error.message : 'Unknown error'));
  };

  const handleSaveEdits = async () => {
    if (!editForm) return;
    if (!Array.isArray(editForm.sourceAccounts) || editForm.sourceAccounts.length === 0) {
      toast.error('No source account is linked to this task.');
      return;
    }
    if (!Array.isArray(editForm.targetAccounts) || editForm.targetAccounts.length === 0) {
      toast.error('No target account is linked to this task.');
      return;
    }
    const overlappingAccounts = editForm.sourceAccounts.filter((id: string) =>
      editForm.targetAccounts.includes(id)
    );
    if (overlappingAccounts.length > 0) {
      toast.error('A single account cannot be both source and target in the same task.');
      return;
    }
    if (hasTwitterSource) {
      if (editForm.twitterSourceType === 'username' && !editForm.twitterUsername.trim()) {
        toast.error('Please enter a Twitter username for the source');
        return;
      }
      if (editForm.triggerType === 'on_like' && editForm.twitterSourceType === 'username') {
        toast.error('Liked-tweet trigger requires a connected Twitter account');
        return;
      }
      if (
        (editForm.triggerType === 'on_keyword' ||
          editForm.triggerType === 'on_hashtag' ||
          editForm.triggerType === 'on_search') &&
        !editForm.triggerValue.trim()
      ) {
        toast.error('Please enter a trigger value for the selected trigger type');
        return;
      }
    }
    if (
      hasYouTubeTarget &&
      editForm.youtubeActions?.uploadVideoToPlaylist &&
      !editForm.youtubeActions?.playlistId
    ) {
      toast.error('Please select a YouTube playlist or disable "Upload video to playlist".');
      return;
    }
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description,
          sourceAccounts: editForm.sourceAccounts,
          targetAccounts: editForm.targetAccounts,
          executionType: editForm.executionType,
          scheduleTime: editForm.scheduleTime ? new Date(editForm.scheduleTime) : undefined,
          recurringPattern: editForm.recurringPattern,
          transformations: {
            template: editForm.template || undefined,
            includeMedia: editForm.includeMedia,
            enableYtDlp: editForm.enableYtDlp,
            twitterActions: editForm.twitterActions,
            youtubeActions: {
              uploadVideo: editForm.youtubeActions?.uploadVideo,
              uploadVideoToPlaylist: editForm.youtubeActions?.uploadVideoToPlaylist,
              playlistId: editForm.youtubeActions?.uploadVideoToPlaylist
                ? editForm.youtubeActions?.playlistId || undefined
                : undefined,
            },
            youtubeVideo: {
              titleTemplate: editForm.youtubeVideo?.titleTemplate || undefined,
              descriptionTemplate: editForm.youtubeVideo?.descriptionTemplate || undefined,
              tags: String(editForm.youtubeVideo?.tagsText || '')
                .split(/[\n,]/)
                .map((tag: string) => tag.trim())
                .filter(Boolean),
              privacyStatus: editForm.youtubeVideo?.privacyStatus || 'public',
              categoryId:
                resolveYouTubeCategoryId(editForm.youtubeVideo?.categoryId) ||
                DEFAULT_YOUTUBE_CATEGORY_ID,
              embeddable: editForm.youtubeVideo?.embeddable !== false,
              license: editForm.youtubeVideo?.license || 'youtube',
              publicStatsViewable: editForm.youtubeVideo?.publicStatsViewable !== false,
              selfDeclaredMadeForKids: editForm.youtubeVideo?.selfDeclaredMadeForKids === true,
              notifySubscribers: editForm.youtubeVideo?.notifySubscribers !== false,
              publishAt: editForm.youtubeVideo?.publishAt
                ? new Date(editForm.youtubeVideo.publishAt).toISOString()
                : undefined,
              defaultLanguage: editForm.youtubeVideo?.defaultLanguage || undefined,
              defaultAudioLanguage: editForm.youtubeVideo?.defaultAudioLanguage || undefined,
              recordingDate: editForm.youtubeVideo?.recordingDate
                ? new Date(`${editForm.youtubeVideo.recordingDate}T00:00:00.000Z`).toISOString()
                : undefined,
            },
          },
          filters: hasTwitterSource
            ? {
                twitterSourceType: editForm.twitterSourceType,
                twitterUsername: editForm.twitterUsername.trim() || undefined,
                excludeReplies: editForm.excludeReplies,
                excludeRetweets: editForm.excludeRetweets,
                excludeQuotes: editForm.excludeQuotes,
                originalOnly: editForm.originalOnly,
                pollIntervalSeconds: Number(editForm.pollIntervalSeconds || 60),
                triggerType: editForm.triggerType,
                triggerValue: editForm.triggerValue.trim() || undefined,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update task');
      setTask(data.task);
      setIsEditing(false);
      toast.success('Task updated successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  if (!task || !stats) {
    return (
      <div className="min-h-screen bg-background control-app dashboard-shell-bg">
        <Sidebar />
        <Header />
        <main className="control-main premium-main">
          <div className="page-header premium-page-header animate-fade-up">
            <div>
              <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
                <Sparkles size={12} />
                Task Operations
              </p>
              <h1 className="page-title">Loading task details</h1>
              <p className="page-subtitle">Preparing task overview and runtime insights.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const effectiveSourceAccountIds: string[] =
    Array.isArray(editForm?.sourceAccounts) && editForm.sourceAccounts.length > 0
      ? editForm.sourceAccounts
      : task.sourceAccounts;
  const effectiveTargetAccountIds: string[] =
    Array.isArray(editForm?.targetAccounts) && editForm.targetAccounts.length > 0
      ? editForm.targetAccounts
      : task.targetAccounts;
  const hasTwitterSource = accounts.some(
    a => effectiveSourceAccountIds.includes(a.id) && a.platformId === 'twitter'
  );
  const hasTwitterTarget = accounts.some(
    a => effectiveTargetAccountIds.includes(a.id) && a.platformId === 'twitter'
  );
  const youtubeTargetAccounts = accounts.filter(
    a => effectiveTargetAccountIds.includes(a.id) && a.platformId === 'youtube'
  );
  const hasYouTubeTarget = youtubeTargetAccounts.length > 0;
  const youtubePlaylists: Array<{ id: string; title: string }> = [];
  const youtubePlaylistSeen = new Set<string>();
  for (const account of youtubeTargetAccounts) {
    const available = Array.isArray((account.credentials as any)?.availablePlaylists)
      ? (account.credentials as any).availablePlaylists
      : [];
    for (const item of available) {
      const id = String(item?.id || '');
      const title = String(item?.title || item?.id || '');
      if (!id || !title || youtubePlaylistSeen.has(id)) continue;
      youtubePlaylistSeen.add(id);
      youtubePlaylists.push({ id, title });
    }
  }
  const accountLabelById = new Map(
    accounts.map((a) => [a.id, `${a.accountName} (@${a.accountUsername})`])
  );

  return (
    <div className="min-h-screen bg-background control-app dashboard-shell-bg">
      <Sidebar />
      <Header />

      <main className="control-main premium-main">
        <div className="page-header premium-page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Task Operations
            </p>
            <h1 className="page-title">{task.name}</h1>
            <p className="page-subtitle">
              Task ID: {taskId.substring(0, 8)}... • Real-time execution diagnostics
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRunTask}>
              <Play size={18} className="mr-2" />
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

            <Button variant="outline" onClick={() => setIsEditing((prev) => !prev)}>
              <Edit2 size={18} className="mr-2" />
              {isEditing ? 'Close Quick Edit' : 'Quick Edit'}
            </Button>

            <Button variant="outline" onClick={() => router.push(`/tasks/${taskId}/edit`)}>
              <Edit2 size={18} className="mr-2" />
              Full Editor
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/executions?taskId=${encodeURIComponent(taskId)}&taskName=${encodeURIComponent(task.name)}`
                )
              }
            >
              <ArrowRight size={18} className="mr-2" />
              View Logs
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
          <Card className="mb-8 surface-card">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Source Account(s)
                  </label>
                  <div className="rounded-md border border-border p-3 text-sm text-foreground space-y-1">
                    {Array.isArray(editForm.sourceAccounts) && editForm.sourceAccounts.length > 0 ? (
                      editForm.sourceAccounts.map((id: string) => (
                        <div key={`src-${id}`}>{accountLabelById.get(id) || `Unknown account (${id})`}</div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No source account selected</div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Target Account(s)
                  </label>
                  <div className="rounded-md border border-border p-3 text-sm text-foreground space-y-1">
                    {Array.isArray(editForm.targetAccounts) && editForm.targetAccounts.length > 0 ? (
                      editForm.targetAccounts.map((id: string) => (
                        <div key={`tgt-${id}`}>{accountLabelById.get(id) || `Unknown account (${id})`}</div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">No target account selected</div>
                    )}
                  </div>
                </div>
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
                      <SelectItem value="custom">Custom</SelectItem>
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

              {hasTwitterSource && (
                <div>
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
                </div>
              )}

              {hasTwitterTarget && (
                <div className="space-y-4">
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

              {hasYouTubeTarget && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    YouTube Actions
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeActions?.uploadVideo}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeActions: { ...prev.youtubeActions, uploadVideo: e.target.checked },
                        }))
                      }
                    />
                    Upload video
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeActions?.uploadVideoToPlaylist}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeActions: {
                            ...prev.youtubeActions,
                            uploadVideoToPlaylist: e.target.checked,
                          },
                        }))
                      }
                    />
                    Upload video to playlist
                  </label>
                  {editForm.youtubeActions?.uploadVideoToPlaylist && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Playlist
                      </label>
                      {youtubePlaylists.length > 0 ? (
                        <Select
                          value={editForm.youtubeActions?.playlistId || ''}
                          onValueChange={(value: string) =>
                            setEditForm((prev: any) => ({
                              ...prev,
                              youtubeActions: { ...prev.youtubeActions, playlistId: value },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select YouTube playlist" />
                          </SelectTrigger>
                          <SelectContent>
                            {youtubePlaylists.map(playlist => (
                              <SelectItem key={playlist.id} value={playlist.id}>
                                {playlist.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No playlists detected for this YouTube account. Reconnect account to refresh playlists.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Video Title Template
                    </label>
                    <Input
                      value={editForm.youtubeVideo?.titleTemplate || ''}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: { ...prev.youtubeVideo, titleTemplate: e.target.value },
                        }))
                      }
                      placeholder="%text%"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Video Description Template
                    </label>
                    <Textarea
                      value={editForm.youtubeVideo?.descriptionTemplate || ''}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: { ...prev.youtubeVideo, descriptionTemplate: e.target.value },
                        }))
                      }
                      rows={4}
                      placeholder="%text%&#10;&#10;%link%"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Placeholders: %text%, %username%, %name%, %date%, %link%, %media%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tags (comma or new line separated)
                    </label>
                    <Textarea
                      value={editForm.youtubeVideo?.tagsText || ''}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: { ...prev.youtubeVideo, tagsText: e.target.value },
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Privacy
                      </label>
                      <Select
                        value={editForm.youtubeVideo?.privacyStatus || 'public'}
                        onValueChange={(value: any) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: { ...prev.youtubeVideo, privacyStatus: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="unlisted">Unlisted</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        License
                      </label>
                      <Select
                        value={editForm.youtubeVideo?.license || 'youtube'}
                        onValueChange={(value: any) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: { ...prev.youtubeVideo, license: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="youtube">Standard YouTube License</SelectItem>
                          <SelectItem value="creativeCommon">Creative Commons</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Category
                      </label>
                      <Select
                        value={editForm.youtubeVideo?.categoryId || DEFAULT_YOUTUBE_CATEGORY_ID}
                        onValueChange={(value: string) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: { ...prev.youtubeVideo, categoryId: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YOUTUBE_VIDEO_CATEGORIES.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Schedule Publish At (optional)
                      </label>
                      <Input
                        type="datetime-local"
                        value={editForm.youtubeVideo?.publishAt || ''}
                        onChange={(e) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: { ...prev.youtubeVideo, publishAt: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Language
                      </label>
                      <Input
                        value={editForm.youtubeVideo?.defaultLanguage || ''}
                        onChange={(e) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: { ...prev.youtubeVideo, defaultLanguage: e.target.value },
                          }))
                        }
                        placeholder="en"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Audio Language
                      </label>
                      <Input
                        value={editForm.youtubeVideo?.defaultAudioLanguage || ''}
                        onChange={(e) =>
                          setEditForm((prev: any) => ({
                            ...prev,
                            youtubeVideo: {
                              ...prev.youtubeVideo,
                              defaultAudioLanguage: e.target.value,
                            },
                          }))
                        }
                        placeholder="en"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Recording Date (optional)
                    </label>
                    <Input
                      type="date"
                      value={editForm.youtubeVideo?.recordingDate || ''}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: { ...prev.youtubeVideo, recordingDate: e.target.value },
                        }))
                      }
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeVideo?.embeddable !== false}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: { ...prev.youtubeVideo, embeddable: e.target.checked },
                        }))
                      }
                    />
                    Allow embedding
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeVideo?.publicStatsViewable !== false}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: {
                            ...prev.youtubeVideo,
                            publicStatsViewable: e.target.checked,
                          },
                        }))
                      }
                    />
                    Public stats viewable
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeVideo?.selfDeclaredMadeForKids === true}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: {
                            ...prev.youtubeVideo,
                            selfDeclaredMadeForKids: e.target.checked,
                          },
                        }))
                      }
                    />
                    Made for kids
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.youtubeVideo?.notifySubscribers !== false}
                      onChange={(e) =>
                        setEditForm((prev: any) => ({
                          ...prev,
                          youtubeVideo: {
                            ...prev.youtubeVideo,
                            notifySubscribers: e.target.checked,
                          },
                        }))
                      }
                    />
                    Notify subscribers
                  </label>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
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
            className={`kpi-pill inline-flex px-4 py-2 text-sm font-semibold ${
              task.status === 'active'
                ? 'border border-primary/30 bg-primary/10 text-primary'
                : 'border border-border/70 bg-muted/55 text-muted-foreground'
            }`}
          >
            {task.status.toUpperCase()}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="equal-grid mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="surface-card h-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Total Executions</p>
              <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>

          <Card className="surface-card h-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Successful</p>
              <p className="text-3xl font-bold text-primary">
                {stats.successful}
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card h-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Failed</p>
              <p className="text-3xl font-bold text-destructive">
                {stats.failed}
              </p>
            </CardContent>
          </Card>

          <Card className="surface-card h-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-2">Success Rate</p>
              <p className="text-3xl font-bold text-primary">
                {stats.successRate}%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="equal-grid grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Task Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Task Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground">{task.description || 'No description'}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Execution Type</p>
                    <p className="text-foreground capitalize">{task.executionType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Content Type</p>
                    <p className="text-foreground capitalize">{task.contentType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Card className="surface-card">
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
                            <CheckCircle size={16} className="text-primary" />
                          ) : (
                            <AlertCircle size={16} className="text-destructive" />
                          )}
                          <div className="text-sm">
                            <p className="font-medium text-foreground">
                              {exec.status === 'success' ? 'Success' : 'Failed'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(exec.executedAt).toLocaleString()}
                            </p>
                            {(() => {
                              const youtubeLink = extractYouTubeVideoLinks(exec.responseData)[0];
                              if (!youtubeLink) return null;
                              return (
                                <a
                                  href={youtubeLink}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="mt-1 inline-flex text-xs font-medium text-primary hover:underline"
                                >
                                  Open uploaded YouTube video
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                        {exec.error && (
                          <span className="text-xs text-destructive">
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
            <Card className="surface-card">
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
                  {performanceReport?.recommendations.map((rec: string, idx: number) => (
                    <p key={idx} className="text-xs text-muted-foreground">
                      • {rec}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Failure Prediction */}
            {failurePrediction && failurePrediction.riskLevel > 0 && (
              <Card
                className={`surface-card ${failurePrediction.riskLevel > 50 ? 'border-destructive' : ''}`}
              >
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
                              ? 'bg-secondary'
                              : 'bg-primary'
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
                      {failurePrediction.factors.map((factor: string, idx: number) => (
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
              <Card className="surface-card">
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
      {ConfirmDialog}
    </div>
  );
}
