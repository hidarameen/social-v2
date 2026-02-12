'use client';

import { Suspense, useEffect, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PlatformAccount, Task } from '@/lib/db';
import { Plus, Search, Edit2, Trash2, Play, Pause } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/components/common/use-confirm-dialog';
import { platformConfigs } from '@/lib/platforms/handlers';
import type { PlatformId } from '@/lib/platforms/types';
import { PlatformIcon } from '@/components/common/platform-icon';
import {
  DEFAULT_YOUTUBE_CATEGORY_ID,
  resolveYouTubeCategoryId,
  YOUTUBE_VIDEO_CATEGORIES,
} from '@/lib/youtube-categories';

const createDefaultTaskForm = () => ({
  name: '',
  description: '',
  sourcePlatform: '',
  sourceAccountId: '',
  targetPlatform: '',
  targetAccountId: '',
  executionType: 'immediate' as 'immediate' | 'scheduled' | 'recurring',
  scheduleTime: '',
  recurringPattern: 'daily' as 'daily' | 'weekly' | 'monthly' | 'custom',
  template: '',
  includeMedia: true,
  enableYtDlp: false,
  twitterSourceType: 'account' as 'account' | 'username',
  twitterUsername: '',
  excludeReplies: false,
  excludeRetweets: false,
  excludeQuotes: false,
  originalOnly: false,
  pollIntervalSeconds: 60,
  triggerType: 'on_tweet' as
    | 'on_tweet'
    | 'on_mention'
    | 'on_keyword'
    | 'on_hashtag'
    | 'on_search'
    | 'on_retweet'
    | 'on_like',
  triggerValue: '',
  twitterActions: {
    post: true,
    reply: false,
    quote: false,
    retweet: false,
    like: false,
  },
  youtubeActions: {
    uploadVideo: true,
    uploadVideoToPlaylist: false,
    playlistId: '',
  },
  youtubeVideo: {
    titleTemplate: '',
    descriptionTemplate: '',
    tagsText: '',
    privacyStatus: 'public' as 'private' | 'unlisted' | 'public',
    categoryId: DEFAULT_YOUTUBE_CATEGORY_ID,
    embeddable: true,
    license: 'youtube' as 'youtube' | 'creativeCommon',
    publicStatsViewable: true,
    selfDeclaredMadeForKids: false,
    notifySubscribers: true,
    publishAt: '',
    defaultLanguage: '',
    defaultAudioLanguage: '',
    recordingDate: '',
  },
});

type TaskDialogForm = ReturnType<typeof createDefaultTaskForm>;

function TasksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'status' | 'name'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<TaskDialogForm>(createDefaultTaskForm());
  const pageSize = 50;

  const toLocalDateTimeInput = (value?: Date | string | null) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const toDateInput = (value?: Date | string | null) => {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const mapTaskToForm = (task: Task): TaskDialogForm => {
    const sourceAccountId = task.sourceAccounts[0] || '';
    const targetAccountId = task.targetAccounts[0] || '';
    const sourcePlatform = accounts.find((account) => account.id === sourceAccountId)?.platformId || '';
    const targetPlatform = accounts.find((account) => account.id === targetAccountId)?.platformId || '';

    return {
      name: task.name || '',
      description: task.description || '',
      sourcePlatform,
      sourceAccountId,
      targetPlatform,
      targetAccountId,
      executionType: task.executionType || 'immediate',
      scheduleTime: toLocalDateTimeInput(task.scheduleTime),
      recurringPattern: (task.recurringPattern as 'daily' | 'weekly' | 'monthly' | 'custom') || 'daily',
      template: task.transformations?.template || '',
      includeMedia: task.transformations?.includeMedia !== false,
      enableYtDlp: task.transformations?.enableYtDlp === true,
      twitterSourceType: (task.filters?.twitterSourceType as 'account' | 'username') || 'account',
      twitterUsername: task.filters?.twitterUsername || '',
      excludeReplies: Boolean(task.filters?.excludeReplies),
      excludeRetweets: Boolean(task.filters?.excludeRetweets),
      excludeQuotes: Boolean(task.filters?.excludeQuotes),
      originalOnly: Boolean(task.filters?.originalOnly),
      pollIntervalSeconds: Number(task.filters?.pollIntervalSeconds || 60),
      triggerType:
        (task.filters?.triggerType as
          | 'on_tweet'
          | 'on_mention'
          | 'on_keyword'
          | 'on_hashtag'
          | 'on_search'
          | 'on_retweet'
          | 'on_like') || 'on_tweet',
      triggerValue: task.filters?.triggerValue || '',
      twitterActions: {
        post: task.transformations?.twitterActions?.post !== false,
        reply: task.transformations?.twitterActions?.reply === true,
        quote: task.transformations?.twitterActions?.quote === true,
        retweet: task.transformations?.twitterActions?.retweet === true,
        like: task.transformations?.twitterActions?.like === true,
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
        privacyStatus:
          (task.transformations?.youtubeVideo?.privacyStatus as 'private' | 'unlisted' | 'public') || 'public',
        categoryId:
          resolveYouTubeCategoryId(task.transformations?.youtubeVideo?.categoryId) ||
          DEFAULT_YOUTUBE_CATEGORY_ID,
        embeddable: task.transformations?.youtubeVideo?.embeddable !== false,
        license: (task.transformations?.youtubeVideo?.license as 'youtube' | 'creativeCommon') || 'youtube',
        publicStatsViewable: task.transformations?.youtubeVideo?.publicStatsViewable !== false,
        selfDeclaredMadeForKids: task.transformations?.youtubeVideo?.selfDeclaredMadeForKids === true,
        notifySubscribers: task.transformations?.youtubeVideo?.notifySubscribers !== false,
        publishAt: toLocalDateTimeInput(task.transformations?.youtubeVideo?.publishAt),
        defaultLanguage: task.transformations?.youtubeVideo?.defaultLanguage || '',
        defaultAudioLanguage: task.transformations?.youtubeVideo?.defaultAudioLanguage || '',
        recordingDate: toDateInput(task.transformations?.youtubeVideo?.recordingDate),
      },
    };
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `/api/tasks?limit=${pageSize}&offset=0&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load tasks');
        if (cancelled) return;
        setTasks(data.tasks || []);
        setFilteredTasks(data.tasks || []);
        setOffset(data.nextOffset || 0);
        setHasMore(Boolean(data.hasMore));
      } catch (error) {
        console.error('[v0] TasksPage: Error loading tasks:', error);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [searchTerm, sortBy, sortDir]);

  useEffect(() => {
    const filtered = tasks.filter(task =>
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTasks(filtered);
  }, [searchTerm, tasks]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts?limit=200&offset=0');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (cancelled) return;
        setAccounts((data.accounts || []).filter((account: PlatformAccount) => account.isActive));
      } catch (error) {
        console.error('[v0] TasksPage: Error loading accounts for task dialog:', error);
      }
    }
    loadAccounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const shouldOpen = searchParams.get('create');
    if (shouldOpen === '1' || shouldOpen === 'true') {
      setEditingTaskId(null);
      setCreateForm(createDefaultTaskForm());
      setCreateOpen(true);
      router.replace('/tasks');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!editingTaskId || accounts.length === 0) return;
    setCreateForm((prev) => {
      if (prev.sourcePlatform && prev.targetPlatform) return prev;
      const task = tasks.find((item) => item.id === editingTaskId);
      if (!task) return prev;
      return { ...prev, ...mapTaskToForm(task) };
    });
  }, [editingTaskId, accounts, tasks]);

  const sourceAccounts = accounts.filter(
    account => account.platformId === createForm.sourcePlatform
  );
  const targetAccounts = accounts.filter(
    account => account.platformId === createForm.targetPlatform
  );
  const selectedSourceAccount = accounts.find(
    account => account.id === createForm.sourceAccountId
  );
  const selectedTargetAccount = accounts.find(
    account => account.id === createForm.targetAccountId
  );
  const selectedSourceTwitter = selectedSourceAccount?.platformId === 'twitter';
  const selectedTargetTwitter = selectedTargetAccount?.platformId === 'twitter';
  const selectedTargetYouTube = selectedTargetAccount?.platformId === 'youtube';
  const youtubePlaylists: Array<{ id: string; title: string }> = [];
  if (selectedTargetYouTube) {
    const available = Array.isArray((selectedTargetAccount?.credentials as any)?.availablePlaylists)
      ? (selectedTargetAccount?.credentials as any).availablePlaylists
      : [];
    for (const item of available) {
      const id = String(item?.id || '');
      const title = String(item?.title || item?.id || '');
      if (!id || !title) continue;
      youtubePlaylists.push({ id, title });
    }
  }

  const resetCreateForm = () => {
    setCreateForm(createDefaultTaskForm());
  };

  const openCreateDialog = () => {
    setEditingTaskId(null);
    resetCreateForm();
    setCreateOpen(true);
  };

  const openEditDialog = (task: Task) => {
    setEditingTaskId(task.id);
    setCreateForm(mapTaskToForm(task));
    setCreateOpen(true);
  };

  const handleTaskDialogOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setEditingTaskId(null);
      setIsCreating(false);
      resetCreateForm();
    }
  };

  const handleQuickCreateTask = async () => {
    if (isCreating) return;
    if (!createForm.name.trim()) {
      toast.error('Task name is required');
      return;
    }
    if (!createForm.sourceAccountId || !createForm.targetAccountId) {
      toast.error('Please select source and target accounts');
      return;
    }
    if (createForm.sourceAccountId === createForm.targetAccountId) {
      toast.error('Source and target accounts must be different');
      return;
    }
    if (selectedSourceTwitter) {
      if (createForm.twitterSourceType === 'username' && !createForm.twitterUsername.trim()) {
        toast.error('Please enter a Twitter username for the source');
        return;
      }
      if (createForm.triggerType === 'on_like' && createForm.twitterSourceType === 'username') {
        toast.error('Liked-tweet trigger requires a connected Twitter account');
        return;
      }
      if (
        (createForm.triggerType === 'on_keyword' ||
          createForm.triggerType === 'on_hashtag' ||
          createForm.triggerType === 'on_search') &&
        !createForm.triggerValue.trim()
      ) {
        toast.error('Please enter a trigger value for the selected trigger type');
        return;
      }
    }
    if (createForm.executionType === 'scheduled' && !createForm.scheduleTime) {
      toast.error('Please choose a schedule time');
      return;
    }
    if (
      selectedTargetYouTube &&
      createForm.youtubeActions.uploadVideoToPlaylist &&
      !createForm.youtubeActions.playlistId
    ) {
      toast.error('Please select a YouTube playlist or disable "Upload video to playlist".');
      return;
    }

    try {
      setIsCreating(true);
      const requestBody = {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        sourceAccounts: [createForm.sourceAccountId],
        targetAccounts: [createForm.targetAccountId],
        contentType: 'text',
        status: 'active',
        executionType: createForm.executionType,
        scheduleTime:
          createForm.executionType === 'scheduled' && createForm.scheduleTime
            ? new Date(createForm.scheduleTime).toISOString()
            : undefined,
        recurringPattern:
          createForm.executionType === 'recurring'
            ? createForm.recurringPattern
            : undefined,
        transformations: {
          template: createForm.template || undefined,
          includeMedia: createForm.includeMedia,
          enableYtDlp: createForm.enableYtDlp,
          twitterActions: createForm.twitterActions,
          youtubeActions: {
            uploadVideo: createForm.youtubeActions.uploadVideo,
            uploadVideoToPlaylist: createForm.youtubeActions.uploadVideoToPlaylist,
            playlistId: createForm.youtubeActions.uploadVideoToPlaylist
              ? createForm.youtubeActions.playlistId || undefined
              : undefined,
          },
          youtubeVideo: {
            titleTemplate: createForm.youtubeVideo.titleTemplate || undefined,
            descriptionTemplate: createForm.youtubeVideo.descriptionTemplate || undefined,
            tags: createForm.youtubeVideo.tagsText
              .split(/[\n,]/)
              .map((tag) => tag.trim())
              .filter(Boolean),
            privacyStatus: createForm.youtubeVideo.privacyStatus,
            categoryId:
              resolveYouTubeCategoryId(createForm.youtubeVideo.categoryId) ||
              DEFAULT_YOUTUBE_CATEGORY_ID,
            embeddable: createForm.youtubeVideo.embeddable,
            license: createForm.youtubeVideo.license,
            publicStatsViewable: createForm.youtubeVideo.publicStatsViewable,
            selfDeclaredMadeForKids: createForm.youtubeVideo.selfDeclaredMadeForKids,
            notifySubscribers: createForm.youtubeVideo.notifySubscribers,
            publishAt: createForm.youtubeVideo.publishAt
              ? new Date(createForm.youtubeVideo.publishAt).toISOString()
              : undefined,
            defaultLanguage: createForm.youtubeVideo.defaultLanguage || undefined,
            defaultAudioLanguage: createForm.youtubeVideo.defaultAudioLanguage || undefined,
            recordingDate: createForm.youtubeVideo.recordingDate
              ? new Date(`${createForm.youtubeVideo.recordingDate}T00:00:00.000Z`).toISOString()
              : undefined,
          },
        },
        filters: selectedSourceTwitter
          ? {
              twitterSourceType: createForm.twitterSourceType,
              twitterUsername: createForm.twitterUsername.trim() || undefined,
              excludeReplies: createForm.excludeReplies,
              excludeRetweets: createForm.excludeRetweets,
              excludeQuotes: createForm.excludeQuotes,
              originalOnly: createForm.originalOnly,
              pollIntervalSeconds: Number(createForm.pollIntervalSeconds || 60),
              triggerType: createForm.triggerType,
              triggerValue: createForm.triggerValue.trim() || undefined,
            }
          : undefined,
      };

      const isEditMode = Boolean(editingTaskId);
      const endpoint = isEditMode ? `/api/tasks/${editingTaskId}` : '/api/tasks';
      const method = isEditMode ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || (isEditMode ? 'Failed to update task' : 'Failed to create task'));

      if (isEditMode) {
        setTasks((prev) => prev.map((task) => (task.id === data.task.id ? data.task : task)));
        setFilteredTasks((prev) => prev.map((task) => (task.id === data.task.id ? data.task : task)));
        toast.success('Task updated successfully');
      } else {
        setTasks(prev => [data.task, ...prev]);
        setFilteredTasks(prev => [data.task, ...prev]);
        toast.success(data.duplicate ? 'Task already exists and was reused' : 'Task created successfully');
      }
      handleTaskDialogOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (editingTaskId ? 'Failed to update task' : 'Failed to create task'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadMore = async () => {
    try {
      const res = await fetch(
        `/api/tasks?limit=${pageSize}&offset=${offset}&search=${encodeURIComponent(searchTerm)}&sortBy=${sortBy}&sortDir=${sortDir}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load tasks');
      const next = [...tasks, ...(data.tasks || [])];
      setTasks(next);
      setFilteredTasks(next);
      setOffset(data.nextOffset || offset);
      setHasMore(Boolean(data.hasMore));
    } catch (error) {
      console.error('[v0] TasksPage: Error loading more tasks:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    console.log('[v0] handleDelete: Attempting to delete task:', taskId);
    const accepted = await confirm({
      title: 'Delete Task?',
      description: 'This action is permanent and cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!accepted) return;

    fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to delete task');
        setTasks(tasks.filter(t => t.id !== taskId));
        toast.success('Task deleted successfully');
      })
      .catch(error => {
        console.error('[v0] handleDelete: Error deleting task:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to delete task');
      });
  };

  const handleToggleStatus = (task: Task) => {
    const newStatus = task.status === 'active' ? 'paused' : 'active';
    console.log('[v0] handleToggleStatus: Changing status of task:', task.id, 'to:', newStatus);
    fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to update task');
        setTasks(tasks.map(t => (t.id === task.id ? { ...t, status: newStatus as any } : t)));
        toast.success(newStatus === 'active' ? 'Task resumed' : 'Task paused');
      })
      .catch(error => {
        console.error('[v0] handleToggleStatus: Error updating status:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to update task');
      });
  };

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main">
        <div className="page-header animate-fade-up">
          <div>
            <h1 className="page-title">
              My Tasks
            </h1>
            <p className="page-subtitle">
              Manage and monitor your automation tasks
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={handleTaskDialogOpenChange}>
            <Button size="lg" onClick={openCreateDialog}>
              <Plus size={18} />
              Create New Task
            </Button>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTaskId ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogDescription>
                  {editingTaskId
                    ? 'Update task settings directly from this popup.'
                    : 'Create a task directly from this popup.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Task Name
                    </label>
                    <Input
                      placeholder="e.g., Instagram to X Auto Sync"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm(prev => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Description
                    </label>
                    <Textarea
                      placeholder="Optional task description..."
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm(prev => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Source Platform
                    </label>
                    <Select
                      value={createForm.sourcePlatform}
                      onValueChange={(value) =>
                        setCreateForm(prev => ({
                          ...prev,
                          sourcePlatform: value,
                          sourceAccountId: '',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(platformConfigs).map(([platformId, config]) => (
                          <SelectItem key={platformId} value={platformId}>
                            <span className="inline-flex items-center gap-2">
                              <PlatformIcon platformId={platformId as PlatformId} size={16} />
                              <span>{config.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Source Account
                    </label>
                    <Select
                      value={createForm.sourceAccountId}
                      onValueChange={(value) =>
                        setCreateForm(prev => ({ ...prev, sourceAccountId: value }))
                      }
                      disabled={!createForm.sourcePlatform}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountName || account.accountUsername || account.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Target Platform
                    </label>
                    <Select
                      value={createForm.targetPlatform}
                      onValueChange={(value) =>
                        setCreateForm(prev => ({
                          ...prev,
                          targetPlatform: value,
                          targetAccountId: '',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target platform" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(platformConfigs).map(([platformId, config]) => (
                          <SelectItem key={platformId} value={platformId}>
                            <span className="inline-flex items-center gap-2">
                              <PlatformIcon platformId={platformId as PlatformId} size={16} />
                              <span>{config.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Target Account
                    </label>
                    <Select
                      value={createForm.targetAccountId}
                      onValueChange={(value) =>
                        setCreateForm(prev => ({ ...prev, targetAccountId: value }))
                      }
                      disabled={!createForm.targetPlatform}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target account" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountName || account.accountUsername || account.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Execution Type
                    </label>
                    <Select
                      value={createForm.executionType}
                      onValueChange={(value: 'immediate' | 'scheduled' | 'recurring') =>
                        setCreateForm(prev => ({ ...prev, executionType: value }))
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
                  {createForm.executionType === 'scheduled' && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Schedule Time
                      </label>
                      <Input
                        type="datetime-local"
                        value={createForm.scheduleTime}
                        onChange={(e) =>
                          setCreateForm(prev => ({ ...prev, scheduleTime: e.target.value }))
                        }
                      />
                    </div>
                  )}
                  {createForm.executionType === 'recurring' && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Recurrence Pattern
                      </label>
                      <Select
                        value={createForm.recurringPattern}
                        onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom') =>
                          setCreateForm(prev => ({ ...prev, recurringPattern: value }))
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
                </div>

                <div className="rounded-xl border border-border/70 p-4 space-y-3">
                  <label className="block text-sm font-medium text-foreground">
                    Message Template
                  </label>
                  <Textarea
                    placeholder="%name% (@%username%)&#10;%date%&#10;%text%&#10;%link%"
                    value={createForm.template}
                    onChange={(e) =>
                      setCreateForm(prev => ({ ...prev, template: e.target.value }))
                    }
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={createForm.includeMedia}
                        onChange={(e) =>
                          setCreateForm(prev => ({ ...prev, includeMedia: e.target.checked }))
                        }
                      />
                      Include media
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={createForm.enableYtDlp}
                        onChange={(e) =>
                          setCreateForm(prev => ({ ...prev, enableYtDlp: e.target.checked }))
                        }
                      />
                      Enable yt-dlp for Twitter videos
                    </label>
                  </div>
                </div>

                {selectedSourceTwitter && (
                  <div className="rounded-xl border border-border/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Twitter Source Settings</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Source Type
                        </label>
                        <Select
                          value={createForm.twitterSourceType}
                          onValueChange={(value: 'account' | 'username') =>
                            setCreateForm(prev => ({ ...prev, twitterSourceType: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="account">Connected Account</SelectItem>
                            <SelectItem value="username">Username</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {createForm.twitterSourceType === 'username' && (
                        <div>
                          <label className="mb-2 block text-sm font-medium text-foreground">
                            Twitter Username
                          </label>
                          <Input
                            placeholder="username (without @)"
                            value={createForm.twitterUsername}
                            onChange={(e) =>
                              setCreateForm(prev => ({ ...prev, twitterUsername: e.target.value }))
                            }
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.excludeReplies}
                          onChange={(e) =>
                            setCreateForm(prev => ({ ...prev, excludeReplies: e.target.checked }))
                          }
                        />
                        Exclude replies
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.excludeRetweets}
                          onChange={(e) =>
                            setCreateForm(prev => ({ ...prev, excludeRetweets: e.target.checked }))
                          }
                        />
                        Exclude retweets
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.excludeQuotes}
                          onChange={(e) =>
                            setCreateForm(prev => ({ ...prev, excludeQuotes: e.target.checked }))
                          }
                        />
                        Exclude quotes
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.originalOnly}
                          onChange={(e) =>
                            setCreateForm(prev => ({ ...prev, originalOnly: e.target.checked }))
                          }
                        />
                        Original tweets only
                      </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Trigger Type
                        </label>
                        <Select
                          value={createForm.triggerType}
                          onValueChange={(
                            value:
                              | 'on_tweet'
                              | 'on_mention'
                              | 'on_keyword'
                              | 'on_hashtag'
                              | 'on_search'
                              | 'on_retweet'
                              | 'on_like'
                          ) => setCreateForm(prev => ({ ...prev, triggerType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_tweet">On Tweet</SelectItem>
                            <SelectItem value="on_mention">On Mention</SelectItem>
                            <SelectItem value="on_keyword">On Keyword</SelectItem>
                            <SelectItem value="on_hashtag">On Hashtag</SelectItem>
                            <SelectItem value="on_search">On Search</SelectItem>
                            <SelectItem value="on_retweet">On Retweet</SelectItem>
                            <SelectItem value="on_like">On Like</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Poll Interval (seconds)
                        </label>
                        <Input
                          type="number"
                          min={10}
                          value={createForm.pollIntervalSeconds}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              pollIntervalSeconds: Number(e.target.value || 60),
                            }))
                          }
                        />
                      </div>
                    </div>

                    {(createForm.triggerType === 'on_keyword' ||
                      createForm.triggerType === 'on_hashtag' ||
                      createForm.triggerType === 'on_search') && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Trigger Value
                        </label>
                        <Input
                          placeholder="keyword, #hashtag, or search query"
                          value={createForm.triggerValue}
                          onChange={(e) =>
                            setCreateForm(prev => ({ ...prev, triggerValue: e.target.value }))
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedTargetTwitter && (
                  <div className="rounded-xl border border-border/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">Twitter Target Actions</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.twitterActions.post}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              twitterActions: { ...prev.twitterActions, post: e.target.checked },
                            }))
                          }
                        />
                        Post
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.twitterActions.reply}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              twitterActions: { ...prev.twitterActions, reply: e.target.checked },
                            }))
                          }
                        />
                        Reply
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.twitterActions.quote}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              twitterActions: { ...prev.twitterActions, quote: e.target.checked },
                            }))
                          }
                        />
                        Quote
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.twitterActions.retweet}
                          onChange={(e) =>
                            setCreateForm(prev => ({
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
                          checked={createForm.twitterActions.like}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              twitterActions: { ...prev.twitterActions, like: e.target.checked },
                            }))
                          }
                        />
                        Like
                      </label>
                    </div>
                  </div>
                )}

                {selectedTargetYouTube && (
                  <div className="rounded-xl border border-border/70 p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-foreground">YouTube Target Settings</h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.youtubeActions.uploadVideo}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeActions: {
                                ...prev.youtubeActions,
                                uploadVideo: e.target.checked,
                              },
                            }))
                          }
                        />
                        Upload video
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.youtubeActions.uploadVideoToPlaylist}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeActions: {
                                ...prev.youtubeActions,
                                uploadVideoToPlaylist: e.target.checked,
                              },
                            }))
                          }
                        />
                        Upload to playlist
                      </label>
                    </div>

                    {createForm.youtubeActions.uploadVideoToPlaylist && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Playlist
                        </label>
                        {youtubePlaylists.length > 0 ? (
                          <Select
                            value={createForm.youtubeActions.playlistId}
                            onValueChange={(value) =>
                              setCreateForm(prev => ({
                                ...prev,
                                youtubeActions: { ...prev.youtubeActions, playlistId: value },
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select playlist" />
                            </SelectTrigger>
                            <SelectContent>
                              {youtubePlaylists.map((playlist) => (
                                <SelectItem key={playlist.id} value={playlist.id}>
                                  {playlist.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No playlists found on selected YouTube account.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Video Title Template
                        </label>
                        <Input
                          placeholder="%text%"
                          value={createForm.youtubeVideo.titleTemplate}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: { ...prev.youtubeVideo, titleTemplate: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Tags (comma or new line)
                        </label>
                        <Input
                          placeholder="automation, social, news"
                          value={createForm.youtubeVideo.tagsText}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: { ...prev.youtubeVideo, tagsText: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Video Description Template
                      </label>
                      <Textarea
                        placeholder="%text%&#10;&#10;%link%"
                        value={createForm.youtubeVideo.descriptionTemplate}
                        onChange={(e) =>
                          setCreateForm(prev => ({
                            ...prev,
                            youtubeVideo: {
                              ...prev.youtubeVideo,
                              descriptionTemplate: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Privacy
                        </label>
                        <Select
                          value={createForm.youtubeVideo.privacyStatus}
                          onValueChange={(value: 'private' | 'unlisted' | 'public') =>
                            setCreateForm(prev => ({
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
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Category
                        </label>
                        <Select
                          value={createForm.youtubeVideo.categoryId}
                          onValueChange={(value: string) =>
                            setCreateForm(prev => ({
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
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          License
                        </label>
                        <Select
                          value={createForm.youtubeVideo.license}
                          onValueChange={(value: 'youtube' | 'creativeCommon') =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: { ...prev.youtubeVideo, license: value },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="creativeCommon">Creative Commons</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Publish At
                        </label>
                        <Input
                          type="datetime-local"
                          value={createForm.youtubeVideo.publishAt}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: { ...prev.youtubeVideo, publishAt: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Default Language
                        </label>
                        <Input
                          placeholder="en"
                          value={createForm.youtubeVideo.defaultLanguage}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: {
                                ...prev.youtubeVideo,
                                defaultLanguage: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">
                          Default Audio Language
                        </label>
                        <Input
                          placeholder="en"
                          value={createForm.youtubeVideo.defaultAudioLanguage}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: {
                                ...prev.youtubeVideo,
                                defaultAudioLanguage: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Recording Date
                      </label>
                      <Input
                        type="date"
                        value={createForm.youtubeVideo.recordingDate}
                        onChange={(e) =>
                          setCreateForm(prev => ({
                            ...prev,
                            youtubeVideo: {
                              ...prev.youtubeVideo,
                              recordingDate: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.youtubeVideo.embeddable}
                          onChange={(e) =>
                            setCreateForm(prev => ({
                              ...prev,
                              youtubeVideo: { ...prev.youtubeVideo, embeddable: e.target.checked },
                            }))
                          }
                        />
                        Embeddable
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createForm.youtubeVideo.publicStatsViewable}
                          onChange={(e) =>
                            setCreateForm(prev => ({
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
                          checked={createForm.youtubeVideo.selfDeclaredMadeForKids}
                          onChange={(e) =>
                            setCreateForm(prev => ({
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
                          checked={createForm.youtubeVideo.notifySubscribers}
                          onChange={(e) =>
                            setCreateForm(prev => ({
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
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  onClick={handleQuickCreateTask}
                  disabled={isCreating}
                >
                  {isCreating ? (editingTaskId ? 'Saving...' : 'Creating...') : (editingTaskId ? 'Save Changes' : 'Create Task')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6 animate-fade-up">
          <CardHeader>
            <CardTitle>Search Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div>
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
            </div>
          </CardContent>
        </Card>
        <div className="mb-6 flex justify-end animate-fade-up-delay">
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = '/api/tasks/export';
            }}
          >
            Export CSV
          </Button>
        </div>

        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No tasks found. {tasks.length === 0 ? 'Create your first task to get started.' : 'Try a different search.'}
              </p>
              {tasks.length === 0 && (
                <Button onClick={openCreateDialog}>
                  <Plus size={18} className="mr-2" />
                  Create Your First Task
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="animate-fade-up hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {task.name}
                          </h3>
                          <span
                            className={`status-pill ${
                              task.status === 'active'
                                ? 'status-pill--success'
                                : 'status-pill--neutral'
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>

                        <p className="text-muted-foreground mb-3">
                          {task.description}
                        </p>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Source:</p>
                            <p className="font-medium text-foreground">
                              {task.sourceAccounts.length} account(s)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target:</p>
                            <p className="font-medium text-foreground">
                              {task.targetAccounts.length} account(s)
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Type:</p>
                            <p className="font-medium text-foreground">
                              {task.executionType}
                            </p>
                          </div>
                          {task.lastExecuted && (
                            <div>
                              <p className="text-muted-foreground">Last run:</p>
                              <p className="font-medium text-foreground">
                                {new Date(task.lastExecuted).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleToggleStatus(task)}
                        >
                          {task.status === 'active' ? (
                            <Pause size={18} />
                          ) : (
                            <Play size={18} />
                          )}
                        </Button>

                        <Button variant="outline" size="icon" onClick={() => openEditDialog(task)}>
                          <Edit2 size={18} />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(task.id)}
                          className="text-destructive"
                        >
                          <Trash2 size={18} />
                        </Button>

                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={handleLoadMore}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      {ConfirmDialog}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background control-app" />}>
      <TasksPageContent />
    </Suspense>
  );
}
