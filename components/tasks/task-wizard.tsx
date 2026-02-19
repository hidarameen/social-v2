'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { PlatformAccount, Task } from '@/lib/db';
import { platformConfigs } from '@/lib/platforms/configs';
import type { PlatformId } from '@/lib/platforms/types';
import { PlatformIcon } from '@/components/common/platform-icon';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DEFAULT_YOUTUBE_CATEGORY_ID,
  resolveYouTubeCategoryId,
  YOUTUBE_VIDEO_CATEGORIES,
} from '@/lib/youtube-categories';

type WizardMode = 'create' | 'edit';

const PLATFORM_ORDER: PlatformId[] = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'telegram',
  'linkedin',
];

type WizardForm = {
  name: string;
  description: string;
  executionType: 'immediate' | 'scheduled' | 'recurring';
  scheduleTime: string;
  recurringPattern: 'daily' | 'weekly' | 'monthly' | 'custom';

  sourceAccounts: string[];
  targetAccounts: string[];
  sourcePlatformFilter: string;
  targetPlatformFilter: string;

  template: string;
  includeMedia: boolean;
  enableYtDlp: boolean;

  telegramSourceChatId: string;
  telegramTargetChatId: string;
  telegramSourceChatIds: string[];
  telegramTargetChatIds: string[];

  twitterSourceType: 'account' | 'username';
  twitterUsername: string;
  excludeReplies: boolean;
  excludeRetweets: boolean;
  excludeQuotes: boolean;
  originalOnly: boolean;
  pollIntervalSeconds: number;
  triggerType:
    | 'on_tweet'
    | 'on_mention'
    | 'on_keyword'
    | 'on_hashtag'
    | 'on_search'
    | 'on_retweet'
    | 'on_like';
  triggerValue: string;

  twitterActions: {
    post: boolean;
    reply: boolean;
    quote: boolean;
    retweet: boolean;
    like: boolean;
  };

  youtubeActions: {
    uploadVideo: boolean;
    uploadVideoToPlaylist: boolean;
    playlistId: string;
  };

  youtubeVideo: {
    titleTemplate: string;
    descriptionTemplate: string;
    tagsText: string;
    privacyStatus: 'private' | 'unlisted' | 'public';
    categoryId: string;
    embeddable: boolean;
    license: 'youtube' | 'creativeCommon';
    publicStatsViewable: boolean;
    selfDeclaredMadeForKids: boolean;
    notifySubscribers: boolean;
    publishAt: string;
    defaultLanguage: string;
    defaultAudioLanguage: string;
    recordingDate: string;
  };
};

function defaultForm(): WizardForm {
  return {
    name: '',
    description: '',
    executionType: 'immediate',
    scheduleTime: '',
    recurringPattern: 'daily',

    sourceAccounts: [],
    targetAccounts: [],
    sourcePlatformFilter: '',
    targetPlatformFilter: '',

    template: '',
    includeMedia: true,
    enableYtDlp: false,

    telegramSourceChatId: '',
    telegramTargetChatId: '',
    telegramSourceChatIds: [],
    telegramTargetChatIds: [],

    twitterSourceType: 'account',
    twitterUsername: '',
    excludeReplies: false,
    excludeRetweets: false,
    excludeQuotes: false,
    originalOnly: false,
    pollIntervalSeconds: 60,
    triggerType: 'on_tweet',
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
      privacyStatus: 'public',
      categoryId: DEFAULT_YOUTUBE_CATEGORY_ID,
      embeddable: true,
      license: 'youtube',
      publicStatsViewable: true,
      selfDeclaredMadeForKids: false,
      notifySubscribers: true,
      publishAt: '',
      defaultLanguage: '',
      defaultAudioLanguage: '',
      recordingDate: '',
    },
  };
}

function toLocalDateTimeInput(value?: Date | string | null) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toDateInput(value?: Date | string | null) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function uniqueIds(ids: string[] = []) {
  return [...new Set(ids.filter(Boolean))];
}

function parseTelegramChatIdentifier(rawValue: string): string | null {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return raw;
  if (raw.startsWith('@')) return raw.toLowerCase();

  const direct = raw.replace(/\s+/g, '');
  const normalizedDirect = direct.toLowerCase();
  if (normalizedDirect.startsWith('t.me/') || normalizedDirect.startsWith('telegram.me/')) {
    const withProtocol = normalizedDirect.startsWith('http') ? direct : `https://${direct}`;
    try {
      const url = new URL(withProtocol);
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length === 0) return null;
      if (segments[0] === 'c' && segments[1] && /^\d+$/.test(segments[1])) {
        return `-100${segments[1]}`;
      }
      if (/^[a-z0-9_]{4,}$/i.test(segments[0])) {
        return `@${segments[0].toLowerCase()}`;
      }
    } catch {
      return null;
    }
  }

  if (/^[a-z0-9_]{4,}$/i.test(raw)) return `@${raw.toLowerCase()}`;
  return null;
}

function parseTelegramChatIdentifiers(input: string): string[] {
  if (!input) return [];
  return uniqueIds(
    input
      .split(/[\n,\s]+/)
      .map((token) => parseTelegramChatIdentifier(token))
      .filter(Boolean) as string[]
  );
}

function labelAccount(account: PlatformAccount): string {
  return (
    account.accountName ||
    (account.accountUsername ? `@${account.accountUsername}` : '') ||
    account.accountId ||
    account.id
  );
}

function SelectedAccountsInline(props: { accounts: PlatformAccount[]; emptyText: string }) {
  const accounts = props.accounts || [];
  if (accounts.length === 0) {
    return <p className="text-xs text-muted-foreground">{props.emptyText}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {accounts.map((account) => (
        <Badge key={account.id} variant="secondary" className="max-w-full truncate">
          {labelAccount(account)}
        </Badge>
      ))}
    </div>
  );
}

function ReservedSettings(props: { platformName: string; side: 'source' | 'target' }) {
  const title = props.side === 'source' ? 'Reserved Source Settings' : 'Reserved Target Settings';
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.platformName} settings will appear here when supported. For now, defaults are used.
          </p>
        </div>
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Mode</label>
          <Input disabled value="" placeholder="Default" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Limits</label>
          <Input disabled value="" placeholder="Default" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Filters</label>
          <Input disabled value="" placeholder="Default" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Advanced</label>
          <Input disabled value="" placeholder="Default" />
        </div>
      </div>
    </div>
  );
}

function stepTitle(step: number) {
  switch (step) {
    case 1:
      return 'Task Info';
    case 2:
      return 'Sources';
    case 3:
      return 'Source Settings';
    case 4:
      return 'Targets';
    case 5:
      return 'Target Settings';
    default:
      return 'Task Setup';
  }
}

export function TaskWizard(props: { mode: WizardMode; taskId?: string }) {
  const router = useRouter();
  const params = useParams();
  const effectiveTaskId = props.taskId || (params?.id as string | undefined);
  const mode = props.mode;
  const draftStorageKey = mode === 'create' ? 'socialflow:task-wizard:create' : null;

  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceChatInput, setSourceChatInput] = useState('');
  const [targetChatInput, setTargetChatInput] = useState('');
  const [openSourcePlatforms, setOpenSourcePlatforms] = useState<Record<string, boolean>>({});
  const [openTargetPlatforms, setOpenTargetPlatforms] = useState<Record<string, boolean>>({});
  const [selectionConflict, setSelectionConflict] = useState<{
    accountId: string;
    side: 'source' | 'target';
    token: number;
  } | null>(null);
  const conflictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<WizardForm>(() => {
    if (typeof window === 'undefined') return defaultForm();
    if (mode !== 'create') return defaultForm();
    try {
      const raw = draftStorageKey ? window.localStorage.getItem(draftStorageKey) : null;
      if (!raw) return defaultForm();
      const parsed = JSON.parse(raw) as { data?: Partial<WizardForm> };
      return { ...defaultForm(), ...(parsed.data || {}) };
    } catch {
      return defaultForm();
    }
  });

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const selectedSourceAccounts = useMemo(
    () => (form.sourceAccounts || []).map((id) => accountById.get(id)).filter(Boolean) as PlatformAccount[],
    [form.sourceAccounts, accountById]
  );
  const selectedTargetAccounts = useMemo(
    () => (form.targetAccounts || []).map((id) => accountById.get(id)).filter(Boolean) as PlatformAccount[],
    [form.targetAccounts, accountById]
  );

  const hasTwitterSource = selectedSourceAccounts.some((a) => a.platformId === 'twitter');
  const hasTwitterTarget = selectedTargetAccounts.some((a) => a.platformId === 'twitter');
  const hasTelegramSource = selectedSourceAccounts.some((a) => a.platformId === 'telegram');
  const hasTelegramTarget = selectedTargetAccounts.some((a) => a.platformId === 'telegram');
  const youtubeTargets = selectedTargetAccounts.filter((a) => a.platformId === 'youtube');
  const hasYouTubeTarget = youtubeTargets.length > 0;
  const sourcePlatforms = useMemo(() => {
    const set = new Set<PlatformId>();
    for (const account of selectedSourceAccounts) set.add(account.platformId as PlatformId);
    return PLATFORM_ORDER.filter((p) => set.has(p));
  }, [selectedSourceAccounts]);
  const targetPlatforms = useMemo(() => {
    const set = new Set<PlatformId>();
    for (const account of selectedTargetAccounts) set.add(account.platformId as PlatformId);
    return PLATFORM_ORDER.filter((p) => set.has(p));
  }, [selectedTargetAccounts]);

  const youtubePlaylists = useMemo(() => {
    const playlists: Array<{ id: string; title: string }> = [];
    const seen = new Set<string>();
    for (const target of youtubeTargets) {
      const available = Array.isArray((target.credentials as any)?.availablePlaylists)
        ? (target.credentials as any).availablePlaylists
        : [];
      for (const item of available) {
        const id = String(item?.id || '');
        const title = String(item?.title || item?.id || '');
        if (!id || !title || seen.has(id)) continue;
        seen.add(id);
        playlists.push({ id, title });
      }
    }
    return playlists;
  }, [youtubeTargets]);

  const sourceCandidateAccounts = useMemo(() => {
    let list = accounts;
    if (form.sourcePlatformFilter) list = list.filter((a) => a.platformId === form.sourcePlatformFilter);
    const q = sourceQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const hay = `${a.platformId} ${labelAccount(a)} ${a.accountUsername || ''} ${a.accountId || ''} ${a.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, form.sourcePlatformFilter, sourceQuery]);

  const targetCandidateAccounts = useMemo(() => {
    let list = accounts;
    if (form.targetPlatformFilter) list = list.filter((a) => a.platformId === form.targetPlatformFilter);
    const q = targetQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const hay = `${a.platformId} ${labelAccount(a)} ${a.accountUsername || ''} ${a.accountId || ''} ${a.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, form.targetPlatformFilter, targetQuery]);

  const sourceCandidateAccountsByPlatform = useMemo(() => {
    const byPlatform = new Map<PlatformId, PlatformAccount[]>();
    for (const account of sourceCandidateAccounts) {
      const platformId = account.platformId as PlatformId;
      const current = byPlatform.get(platformId) || [];
      current.push(account);
      byPlatform.set(platformId, current);
    }
    return PLATFORM_ORDER.filter((platformId) => byPlatform.has(platformId)).map((platformId) => ({
      platformId,
      accounts: byPlatform.get(platformId) || [],
    }));
  }, [sourceCandidateAccounts]);

  const targetCandidateAccountsByPlatform = useMemo(() => {
    const byPlatform = new Map<PlatformId, PlatformAccount[]>();
    for (const account of targetCandidateAccounts) {
      const platformId = account.platformId as PlatformId;
      const current = byPlatform.get(platformId) || [];
      current.push(account);
      byPlatform.set(platformId, current);
    }
    return PLATFORM_ORDER.filter((platformId) => byPlatform.has(platformId)).map((platformId) => ({
      platformId,
      accounts: byPlatform.get(platformId) || [],
    }));
  }, [targetCandidateAccounts]);

  const persistDraft = (next: WizardForm) => {
    if (mode !== 'create') return;
    if (!draftStorageKey) return;
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({ savedAt: Date.now(), data: next }));
    } catch {
      // ignore
    }
  };

  // Keep local draft saved on step transitions / reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode !== 'create') return;
    persistDraft(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadAccounts() {
      try {
        const res = await fetch('/api/accounts?limit=200&offset=0', { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load accounts');
        if (cancelled) return;
        setAccounts(data.accounts || []);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[TaskWizard] Failed to load accounts:', error);
      }
    }
    loadAccounts();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Load task for edit mode.
  useEffect(() => {
    if (mode !== 'edit') return;
    if (!effectiveTaskId) return;

    let cancelled = false;
    const controller = new AbortController();

    async function loadTask() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/tasks/${effectiveTaskId}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load task');
        if (cancelled) return;

        const task = data.task as Task;
        const sourceChatIds = uniqueIds(
          [
            ...parseTelegramChatIdentifiers(String((task.filters as any)?.telegramChatId || '')),
            ...(Array.isArray((task.filters as any)?.telegramChatIds) ? (task.filters as any).telegramChatIds : []),
          ]
            .map((value) => parseTelegramChatIdentifier(String(value || '')))
            .filter(Boolean) as string[]
        );
        const targetChatIds = uniqueIds(
          [
            ...parseTelegramChatIdentifiers(String((task.transformations as any)?.telegramTargetChatId || '')),
            ...(Array.isArray((task.transformations as any)?.telegramTargetChatIds)
              ? (task.transformations as any).telegramTargetChatIds
              : []),
          ]
            .map((value) => parseTelegramChatIdentifier(String(value || '')))
            .filter(Boolean) as string[]
        );

        const fromServer: WizardForm = {
          ...defaultForm(),
          name: task.name || '',
          description: task.description || '',
          executionType: 'immediate',
          scheduleTime: '',
          recurringPattern: 'daily',
          sourceAccounts: Array.isArray(task.sourceAccounts) ? task.sourceAccounts : [],
          targetAccounts: Array.isArray(task.targetAccounts) ? task.targetAccounts : [],
          template: task.transformations?.template || '',
          includeMedia: task.transformations?.includeMedia !== false,
          enableYtDlp: task.transformations?.enableYtDlp === true,
          telegramSourceChatId: sourceChatIds[0] || '',
          telegramTargetChatId: targetChatIds[0] || '',
          telegramSourceChatIds: sourceChatIds,
          telegramTargetChatIds: targetChatIds,
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
            privacyStatus: (task.transformations?.youtubeVideo?.privacyStatus as any) || 'public',
            categoryId:
              resolveYouTubeCategoryId(task.transformations?.youtubeVideo?.categoryId) ||
              DEFAULT_YOUTUBE_CATEGORY_ID,
            embeddable: task.transformations?.youtubeVideo?.embeddable !== false,
            license: (task.transformations?.youtubeVideo?.license as any) || 'youtube',
            publicStatsViewable: task.transformations?.youtubeVideo?.publicStatsViewable !== false,
            selfDeclaredMadeForKids: task.transformations?.youtubeVideo?.selfDeclaredMadeForKids === true,
            notifySubscribers: task.transformations?.youtubeVideo?.notifySubscribers !== false,
            publishAt: toLocalDateTimeInput(task.transformations?.youtubeVideo?.publishAt),
            defaultLanguage: task.transformations?.youtubeVideo?.defaultLanguage || '',
            defaultAudioLanguage: task.transformations?.youtubeVideo?.defaultAudioLanguage || '',
            recordingDate: toDateInput(task.transformations?.youtubeVideo?.recordingDate),
          },
          twitterSourceType: (task.filters?.twitterSourceType as any) || 'account',
          twitterUsername: task.filters?.twitterUsername || '',
          excludeReplies: Boolean(task.filters?.excludeReplies),
          excludeRetweets: Boolean(task.filters?.excludeRetweets),
          excludeQuotes: Boolean(task.filters?.excludeQuotes),
          originalOnly: Boolean(task.filters?.originalOnly),
          pollIntervalSeconds: Number(task.filters?.pollIntervalSeconds || 60),
          triggerType: (task.filters?.triggerType as any) || 'on_tweet',
          triggerValue: task.filters?.triggerValue || '',
          sourcePlatformFilter: '',
          targetPlatformFilter: '',
        };
        setForm(fromServer);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('[TaskWizard] Failed to load task:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load task');
        router.push('/tasks');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadTask();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode, effectiveTaskId, router]);

  const buildRequestBody = (data: WizardForm) => {
    const filtersPayload: Record<string, any> = {};
    const telegramSourceChatIds = uniqueIds(
      [
        ...data.telegramSourceChatIds,
        ...parseTelegramChatIdentifiers(data.telegramSourceChatId),
      ]
        .map((value) => parseTelegramChatIdentifier(String(value || '')))
        .filter(Boolean) as string[]
    );
    const telegramTargetChatIds = uniqueIds(
      [
        ...data.telegramTargetChatIds,
        ...parseTelegramChatIdentifiers(data.telegramTargetChatId),
      ]
        .map((value) => parseTelegramChatIdentifier(String(value || '')))
        .filter(Boolean) as string[]
    );
    if (hasTwitterSource) {
      filtersPayload.twitterSourceType = data.twitterSourceType;
      filtersPayload.twitterUsername = data.twitterUsername.trim() || undefined;
      filtersPayload.excludeReplies = data.excludeReplies;
      filtersPayload.excludeRetweets = data.excludeRetweets;
      filtersPayload.excludeQuotes = data.excludeQuotes;
      filtersPayload.originalOnly = data.originalOnly;
      filtersPayload.pollIntervalSeconds = Number(data.pollIntervalSeconds || 60);
      filtersPayload.triggerType = data.triggerType;
      filtersPayload.triggerValue = data.triggerValue.trim() || undefined;
    }
    if (hasTelegramSource) {
      filtersPayload.telegramChatId = telegramSourceChatIds[0] || undefined;
      filtersPayload.telegramChatIds = telegramSourceChatIds.length > 0 ? telegramSourceChatIds : undefined;
    }
    const includeFilters = Object.values(filtersPayload).some((value) => typeof value !== 'undefined');

    return {
      name: data.name.trim(),
      description: data.description.trim(),
      sourceAccounts: uniqueIds(data.sourceAccounts),
      targetAccounts: uniqueIds(data.targetAccounts),
      contentType: 'text' as const,
      executionType: 'immediate' as const,
      scheduleTime: undefined,
      recurringPattern: undefined,
      transformations: {
        template: data.template || undefined,
        includeMedia: data.includeMedia,
        enableYtDlp: data.enableYtDlp,
        telegramTargetChatId: hasTelegramTarget ? telegramTargetChatIds[0] || undefined : undefined,
        telegramTargetChatIds:
          hasTelegramTarget && telegramTargetChatIds.length > 0 ? telegramTargetChatIds : undefined,
        twitterActions: data.twitterActions,
        youtubeActions: {
          uploadVideo: data.youtubeActions.uploadVideo,
          uploadVideoToPlaylist: data.youtubeActions.uploadVideoToPlaylist,
          playlistId: data.youtubeActions.uploadVideoToPlaylist ? data.youtubeActions.playlistId || undefined : undefined,
        },
        youtubeVideo: {
          titleTemplate: data.youtubeVideo.titleTemplate || undefined,
          descriptionTemplate: data.youtubeVideo.descriptionTemplate || undefined,
          tags: data.youtubeVideo.tagsText
            .split(/[\n,]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          privacyStatus: data.youtubeVideo.privacyStatus,
          categoryId: resolveYouTubeCategoryId(data.youtubeVideo.categoryId) || DEFAULT_YOUTUBE_CATEGORY_ID,
          embeddable: data.youtubeVideo.embeddable,
          license: data.youtubeVideo.license,
          publicStatsViewable: data.youtubeVideo.publicStatsViewable,
          selfDeclaredMadeForKids: data.youtubeVideo.selfDeclaredMadeForKids,
          notifySubscribers: data.youtubeVideo.notifySubscribers,
          publishAt: data.youtubeVideo.publishAt ? new Date(data.youtubeVideo.publishAt).toISOString() : undefined,
          defaultLanguage: data.youtubeVideo.defaultLanguage || undefined,
          defaultAudioLanguage: data.youtubeVideo.defaultAudioLanguage || undefined,
          recordingDate: data.youtubeVideo.recordingDate
            ? new Date(`${data.youtubeVideo.recordingDate}T00:00:00.000Z`).toISOString()
            : undefined,
        },
      },
      filters: includeFilters ? filtersPayload : undefined,
    };
  };

  const validateStep = (s: number, data: WizardForm): string | null => {
    if (s === 1) {
      if (!data.name.trim()) return 'Task name is required';
      return null;
    }
    if (s === 2) {
      if (uniqueIds(data.sourceAccounts).length === 0) return 'Select at least one source account';
      const overlapping = data.sourceAccounts.filter((id) => data.targetAccounts.includes(id));
      if (overlapping.length > 0) return 'A single account cannot be both source and target in the same task';
      return null;
    }
    if (s === 3) {
      if (hasTwitterSource) {
        if (data.twitterSourceType === 'username' && !data.twitterUsername.trim()) {
          return 'Please enter a Twitter username for the source';
        }
        if (data.triggerType === 'on_like' && data.twitterSourceType === 'username') {
          return 'Liked-tweet trigger requires a connected Twitter account';
        }
        if (
          (data.triggerType === 'on_keyword' || data.triggerType === 'on_hashtag' || data.triggerType === 'on_search') &&
          !data.triggerValue.trim()
        ) {
          return 'Please enter a trigger value for the selected trigger type';
        }
      }
      if (hasTelegramSource) {
        const overrideIds = uniqueIds(
          [
            ...data.telegramSourceChatIds,
            ...parseTelegramChatIdentifiers(data.telegramSourceChatId),
          ]
            .map((value) => parseTelegramChatIdentifier(String(value || '')))
            .filter(Boolean) as string[]
        );
        const telegramAccounts = selectedSourceAccounts.filter((a) => a.platformId === 'telegram');
        const hasAccountChatId = telegramAccounts.some((a) => {
          const chatId = String((a.credentials as any)?.chatId || '').trim();
          return Boolean(chatId);
        });
        if (overrideIds.length === 0 && !hasAccountChatId) {
          return 'Telegram sources require at least one chat identifier (ID, @username, or t.me link).';
        }
      }
      return null;
    }
    if (s === 4) {
      if (uniqueIds(data.targetAccounts).length === 0) return 'Select at least one destination account';
      const overlapping = data.sourceAccounts.filter((id) => data.targetAccounts.includes(id));
      if (overlapping.length > 0) return 'A single account cannot be both source and target in the same task';
      return null;
    }
    if (s === 5) {
      if (hasYouTubeTarget && data.youtubeActions.uploadVideoToPlaylist && !data.youtubeActions.playlistId) {
        return 'Please select a YouTube playlist or disable "Upload video to playlist"';
      }
      if (hasTelegramTarget) {
        const overrideIds = uniqueIds(
          [
            ...data.telegramTargetChatIds,
            ...parseTelegramChatIdentifiers(data.telegramTargetChatId),
          ]
            .map((value) => parseTelegramChatIdentifier(String(value || '')))
            .filter(Boolean) as string[]
        );
        const telegramAccounts = selectedTargetAccounts.filter((a) => a.platformId === 'telegram');
        const hasAccountChatId = telegramAccounts.some((a) => {
          const chatId = String((a.credentials as any)?.chatId || '').trim();
          return Boolean(chatId);
        });
        if (overrideIds.length === 0 && !hasAccountChatId) {
          return 'Telegram targets require at least one chat identifier (ID, @username, or t.me link).';
        }
      }
      return null;
    }
    return null;
  };

  const saveToServer = async (data: WizardForm) => {
    if (mode !== 'edit') return true;
    if (!effectiveTaskId) return false;

    const body = buildRequestBody(data);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tasks/${effectiveTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save task');
      setLastSavedAt(new Date());
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save task');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const submitCreate = async (data: WizardForm) => {
    const body = {
      ...buildRequestBody(data),
      status: 'active' as const,
    };
    setIsSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create task');
      try {
        if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
      } catch {
        // ignore
      }
      toast.success(json.duplicate ? 'Task already exists and was reused' : 'Task created successfully');
      router.push('/tasks');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const onNext = async () => {
    const error = validateStep(step, form);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === 'edit') {
      const ok = await saveToServer(form);
      if (!ok) return;
    }
    setStep((s) => Math.min(5, s + 1));
  };

  const onBack = async () => {
    if (mode === 'edit') {
      const ok = await saveToServer(form);
      if (!ok) return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const handleToggleSourceAccount = (accountId: string) => {
    setForm((prev) => {
      if (!prev.sourceAccounts.includes(accountId) && prev.targetAccounts.includes(accountId)) {
        setSelectionConflict({ accountId, side: 'source', token: Date.now() });
        if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
        conflictTimerRef.current = setTimeout(() => setSelectionConflict(null), 650);
        toast.error('This account is already selected as a target. Remove it from targets first.');
        return prev;
      }
      const willSelect = !prev.sourceAccounts.includes(accountId);
      const nextSources = willSelect
        ? uniqueIds([...prev.sourceAccounts, accountId])
        : prev.sourceAccounts.filter((id) => id !== accountId);
      return { ...prev, sourceAccounts: nextSources };
    });
  };

  const handleToggleTargetAccount = (accountId: string) => {
    setForm((prev) => {
      if (!prev.targetAccounts.includes(accountId) && prev.sourceAccounts.includes(accountId)) {
        setSelectionConflict({ accountId, side: 'target', token: Date.now() });
        if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
        conflictTimerRef.current = setTimeout(() => setSelectionConflict(null), 650);
        toast.error('This account is already selected as a source. Remove it from sources first.');
        return prev;
      }
      const willSelect = !prev.targetAccounts.includes(accountId);
      const nextTargets = willSelect
        ? uniqueIds([...prev.targetAccounts, accountId])
        : prev.targetAccounts.filter((id) => id !== accountId);
      return { ...prev, targetAccounts: nextTargets };
    });
  };

  const addTelegramChatTag = (side: 'source' | 'target', rawValue: string) => {
    const parsed = parseTelegramChatIdentifier(rawValue);
    if (!parsed) {
      toast.error('Invalid Telegram identifier. Use numeric ID, @username, or t.me link.');
      return false;
    }
    setForm((prev) => {
      if (side === 'source') {
        return { ...prev, telegramSourceChatIds: uniqueIds([...prev.telegramSourceChatIds, parsed]) };
      }
      return { ...prev, telegramTargetChatIds: uniqueIds([...prev.telegramTargetChatIds, parsed]) };
    });
    return true;
  };

  const removeTelegramChatTag = (side: 'source' | 'target', value: string) => {
    setForm((prev) => {
      if (side === 'source') {
        return { ...prev, telegramSourceChatIds: prev.telegramSourceChatIds.filter((item) => item !== value) };
      }
      return { ...prev, telegramTargetChatIds: prev.telegramTargetChatIds.filter((item) => item !== value) };
    });
  };

  const steps = useMemo(
    () => [
      { step: 1, title: stepTitle(1), icon: FileText, caption: 'Name and description' },
      { step: 2, title: stepTitle(2), icon: ArrowUpRight, caption: 'Pick where content comes from' },
      { step: 3, title: stepTitle(3), icon: SlidersHorizontal, caption: 'Triggers, filters, media rules' },
      { step: 4, title: stepTitle(4), icon: ArrowDownRight, caption: 'Pick where content goes' },
      { step: 5, title: stepTitle(5), icon: Settings2, caption: 'Actions and delivery details' },
    ],
    []
  );

  const stepIssues = useMemo(() => {
    return steps.map(({ step: s }) => ({ step: s, error: validateStep(s, form) }));
  }, [form, steps]);

  const progress = useMemo(() => {
    const done = stepIssues.filter((item) => !item.error).length;
    return Math.round((done / steps.length) * 100);
  }, [stepIssues, steps.length]);

  const stepper = (
    <div className="surface-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Progress</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {mode === 'edit' ? 'Edit Task' : 'Create Task'}
          </h2>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {mode === 'edit' ? (
            <span>
              {isSaving
                ? 'Saving...'
                : lastSavedAt
                  ? `Saved ${lastSavedAt.toLocaleTimeString()}`
                  : 'Not saved yet'}
            </span>
          ) : (
            <span>Draft auto-saved locally</span>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-primary/70 transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Step {step} of {steps.length}: <span className="text-foreground">{stepTitle(step)}</span>
        </p>
      </div>

      <nav className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map(({ step: s, title, icon: Icon, caption }) => {
          const issue = stepIssues.find((it) => it.step === s)?.error || null;
          const isCurrent = s === step;
          const isDone = !issue;

          return (
            <button
              key={s}
              type="button"
              onClick={async () => {
                if (s === step) return;
                // Backwards: always ok.
                if (s < step) {
                  if (mode === 'edit') {
                    const ok = await saveToServer(form);
                    if (!ok) return;
                  }
                  setStep(s);
                  return;
                }

                // Forwards: validate each intermediate step.
                for (let k = step; k < s; k++) {
                  const err = validateStep(k, form);
                  if (err) {
                    toast.error(err);
                    return;
                  }
                }
                if (mode === 'edit') {
                  const ok = await saveToServer(form);
                  if (!ok) return;
                }
                setStep(s);
              }}
              className={cn(
                'group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                isCurrent
                  ? 'border-primary/35 bg-primary/10'
                  : 'border-transparent bg-card/30 hover:border-border/70 hover:bg-card/60',
                s > step && 'opacity-80'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  isCurrent
                    ? 'border-primary/30 bg-primary/12 text-primary'
                    : 'border-border/70 bg-card text-muted-foreground',
                  isDone && !isCurrent ? 'text-primary' : ''
                )}
              >
                {isDone && !isCurrent ? <CheckCircle2 size={16} /> : <Icon size={16} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'truncate text-sm font-semibold',
                      isCurrent ? 'text-foreground' : 'text-foreground/90'
                    )}
                  >
                    {title}
                  </span>
                  {issue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      <AlertTriangle size={12} />
                      Missing
                    </span>
                  ) : (
                    <span className="hidden sm:inline rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      Done
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{caption}</span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-background control-app">
      <Sidebar />
      <Header />

      <main className="control-main relative z-0 overflow-hidden">
        <div aria-hidden className="task-wizard-backdrop pointer-events-none absolute inset-0 -z-10" />
        <div className="page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3">{mode === 'edit' ? 'Edit Task' : 'New Task'}</p>
            <h1 className="page-title">{mode === 'edit' ? 'Edit Automation Task' : 'Create Automation Task'}</h1>
            <p className="page-subtitle">Use Next/Back to complete each section. Each step is saved when you navigate.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/tasks')}>
              Cancel
            </Button>
            {mode === 'edit' ? (
              <Button
                onClick={async () => {
                  const err = validateStep(5, form) || validateStep(4, form) || validateStep(3, form) || validateStep(2, form) || validateStep(1, form);
                  if (err) return toast.error(err);
                  const ok = await saveToServer(form);
                  if (!ok) return;
                  toast.success('Task saved');
                  router.push('/tasks');
                }}
                disabled={isSaving}
              >
                Save
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  // Validate all steps before final submit.
                  for (let s = 1; s <= 5; s++) {
                    const err = validateStep(s, form);
                    if (err) {
                      toast.error(err);
                      setStep(s);
                      return;
                    }
                  }
                  await submitCreate(form);
                }}
                disabled={isSaving}
              >
                Create Task
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 animate-fade-up-delay">
          <div className="mx-auto max-w-[1320px] space-y-4">
            {stepper}
            <div className="space-y-4">
              {isLoading ? (
                <Card className="surface-card">
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-5 w-48 rounded bg-muted/60" />
                      <div className="h-4 w-80 rounded bg-muted/50" />
                      <div className="h-4 w-64 rounded bg-muted/40" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="surface-card">
                  <CardHeader>
                    <CardTitle>{stepTitle(step)}</CardTitle>
                  </CardHeader>
                  <CardContent key={step} className="space-y-4 motion-safe:animate-fade-up task-wizard-step">
                {step === 1 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-foreground">Task Name *</label>
                      <Input
                        placeholder="e.g., Twitter to Telegram Auto Sync"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-foreground">Description</label>
                      <Textarea
                        placeholder="Optional task description..."
                        value={form.description}
                        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Execution mode</p>
                      <p className="mt-1 text-sm font-medium text-foreground">Immediate (system default)</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-foreground">Source Account(s) *</label>
                        <span className="text-xs text-muted-foreground">Selected: {form.sourceAccounts.length}</span>
                      </div>
                      <div className="mb-2">
                        <Input
                          placeholder="Search source accounts..."
                          value={sourceQuery}
                          onChange={(e) => setSourceQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2">
                        {sourceCandidateAccountsByPlatform.length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">No accounts available.</p>
                        ) : (
                          sourceCandidateAccountsByPlatform.map(({ platformId, accounts }) => {
                            const config = platformConfigs[platformId];
                            const selectedCount = accounts.filter((account) => form.sourceAccounts.includes(account.id)).length;
                            const isOpen =
                              openSourcePlatforms[platformId] ??
                              (selectedCount > 0 || sourceQuery.trim().length > 0);
                            return (
                              <div key={platformId} className="rounded-lg border border-border/60 bg-card/45">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                                  onClick={() =>
                                    setOpenSourcePlatforms((prev) => ({
                                      ...prev,
                                      [platformId]: !isOpen,
                                    }))
                                  }
                                >
                                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                                    <PlatformIcon platformId={platformId as PlatformId} size={15} />
                                    {config?.name || platformId}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedCount}/{accounts.length}
                                  </span>
                                </button>
                                {isOpen && (
                                  <div className="space-y-1 border-t border-border/60 p-2">
                                    {accounts.map((account) => {
                                      const selected = form.sourceAccounts.includes(account.id);
                                      const isTarget = form.targetAccounts.includes(account.id);
                                      const isConflict =
                                        selectionConflict?.accountId === account.id &&
                                        selectionConflict?.side === 'source';
                                      return (
                                        <button
                                          key={account.id}
                                          type="button"
                                          onClick={() => handleToggleSourceAccount(account.id)}
                                          className={cn(
                                            'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                            selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted',
                                            !account.isActive && 'opacity-60',
                                            isConflict && 'animate-shake bg-destructive/10 ring-2 ring-destructive/40'
                                          )}
                                        >
                                          <span className="min-w-0">
                                            <span className="truncate font-medium">
                                              {account.accountName || account.accountUsername || account.id}
                                            </span>
                                            {account.accountUsername ? (
                                              <span className="block truncate text-xs text-muted-foreground">@{account.accountUsername}</span>
                                            ) : null}
                                          </span>
                                          <span className="shrink-0 text-xs text-muted-foreground">
                                            {selected ? 'Selected' : isTarget ? 'Target' : ''}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 p-4">
                      <h3 className="text-sm font-semibold text-foreground">What counts as a source?</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Sources are the accounts that will trigger or provide content (polling/stream/webhook). You can select multiple.
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Note: The system blocks selecting the same account as both source and target in one task.
                      </p>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    {sourcePlatforms.map((platformId) => {
                      const meta = platformConfigs[platformId];
                      const header = meta?.name ? `${meta.name} Source Settings` : `${platformId} Source Settings`;
                      const platformAccounts = selectedSourceAccounts.filter(
                        (account) => account.platformId === platformId
                      );

                      if (platformId === 'twitter' && hasTwitterSource) {
                        return (
                          <details key={platformId} className="rounded-xl border border-border/70 p-4" open>
                            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <PlatformIcon platformId={platformId as PlatformId} size={16} />
                                <span>{header}</span>
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Selected Twitter sources</p>
                                <SelectedAccountsInline
                                  accounts={platformAccounts}
                                  emptyText="No Twitter source accounts selected."
                                />
                              </div>
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Source Type</label>
                                  <Select
                                    value={form.twitterSourceType}
                                    onValueChange={(value: 'account' | 'username') =>
                                      setForm((p) => ({ ...p, twitterSourceType: value }))
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
                                {form.twitterSourceType === 'username' && (
                                  <div>
                                    <label className="mb-2 block text-sm font-medium text-foreground">Twitter Username</label>
                                    <Input
                                      placeholder="username (without @)"
                                      value={form.twitterUsername}
                                      onChange={(e) => setForm((p) => ({ ...p, twitterUsername: e.target.value }))}
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.excludeReplies}
                                    onChange={(e) => setForm((p) => ({ ...p, excludeReplies: e.target.checked }))}
                                  />
                                  Exclude replies
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.excludeRetweets}
                                    onChange={(e) => setForm((p) => ({ ...p, excludeRetweets: e.target.checked }))}
                                  />
                                  Exclude retweets
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.excludeQuotes}
                                    onChange={(e) => setForm((p) => ({ ...p, excludeQuotes: e.target.checked }))}
                                  />
                                  Exclude quotes
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.originalOnly}
                                    onChange={(e) => setForm((p) => ({ ...p, originalOnly: e.target.checked }))}
                                  />
                                  Original tweets only
                                </label>
                              </div>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Trigger Type</label>
                                  <Select
                                    value={form.triggerType}
                                    onValueChange={(value: WizardForm['triggerType']) =>
                                      setForm((p) => ({ ...p, triggerType: value }))
                                    }
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
                                  <label className="mb-2 block text-sm font-medium text-foreground">Poll Interval (seconds)</label>
                                  <Input
                                    type="number"
                                    min={10}
                                    value={form.pollIntervalSeconds}
                                    onChange={(e) =>
                                      setForm((p) => ({ ...p, pollIntervalSeconds: Number(e.target.value || 60) }))
                                    }
                                  />
                                </div>
                              </div>

                              {(form.triggerType === 'on_keyword' ||
                                form.triggerType === 'on_hashtag' ||
                                form.triggerType === 'on_search') && (
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Trigger Value</label>
                                  <Input
                                    placeholder="keyword, #hashtag, or search query"
                                    value={form.triggerValue}
                                    onChange={(e) => setForm((p) => ({ ...p, triggerValue: e.target.value }))}
                                  />
                                </div>
                              )}

                              <p className="text-xs text-muted-foreground">
                                Applies to all selected Twitter sources.
                              </p>
                            </div>
                          </details>
                        );
                      }

                      if (platformId === 'telegram' && hasTelegramSource) {
                        const anyAccountHasChatId = platformAccounts.some((a) =>
                          Boolean(String((a.credentials as any)?.chatId || '').trim())
                        );
                        return (
                          <details key={platformId} className="rounded-xl border border-border/70 p-4" open>
                            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <PlatformIcon platformId={platformId as PlatformId} size={16} />
                                <span>{header}</span>
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Selected Telegram sources</p>
                                <SelectedAccountsInline
                                  accounts={platformAccounts}
                                  emptyText="No Telegram source accounts selected."
                                />
                              </div>

                              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <p className="text-xs font-medium text-muted-foreground">Chat ID resolution</p>
                                <div className="mt-2 space-y-2 text-sm">
                                  {platformAccounts.map((account) => {
                                    const chatId = String((account.credentials as any)?.chatId || '').trim();
                                    return (
                                      <div
                                        key={account.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card/60 px-3 py-2"
                                      >
                                        <span className="min-w-0 truncate font-medium">{labelAccount(account)}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {chatId ? `account chatId: ${chatId}` : 'account chatId: not set'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  If your Telegram account does not have `chatId` stored, set an override below.
                                </p>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-foreground">
                                  Telegram source chats (ID, @username, or link)
                                </label>
                                <div className="rounded-lg border border-border/70 bg-card/45 p-2">
                                  <div className="mb-2 flex flex-wrap gap-2">
                                    {form.telegramSourceChatIds.map((chatId) => (
                                      <span
                                        key={chatId}
                                        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs text-foreground"
                                      >
                                        {chatId}
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => removeTelegramChatTag('source', chatId)}
                                          aria-label={`Remove ${chatId}`}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <Input
                                    placeholder="Type chat id / @username / t.me link and press Enter"
                                    value={sourceChatInput}
                                    onChange={(event) => setSourceChatInput(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Enter') return;
                                      event.preventDefault();
                                      const ok = addTelegramChatTag('source', sourceChatInput);
                                      if (ok) setSourceChatInput('');
                                    }}
                                  />
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {anyAccountHasChatId
                                    ? 'Optional. Account chatId(s) are still used when present.'
                                    : 'Add at least one source chat when account chatId is missing.'}
                                </p>
                              </div>
                            </div>
                          </details>
                        );
                      }

                      return (
                        <details key={platformId} className="rounded-xl border border-border/70 p-4">
                          <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                            <span className="inline-flex items-center gap-2">
                              <PlatformIcon platformId={platformId as PlatformId} size={16} />
                              <span>{header}</span>
                            </span>
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="mb-2 text-xs font-medium text-muted-foreground">Selected accounts</p>
                              <SelectedAccountsInline
                                accounts={platformAccounts}
                                emptyText="No accounts selected for this platform."
                              />
                            </div>
                            <ReservedSettings platformName={meta?.name || platformId} side="source" />
                          </div>
                        </details>
                      );
                    })}
                    {sourcePlatforms.length === 0 && (
                      <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                        Select at least one source to configure its settings.
                      </div>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-sm font-medium text-foreground">Target Account(s) *</label>
                        <span className="text-xs text-muted-foreground">Selected: {form.targetAccounts.length}</span>
                      </div>
                      <div className="mb-2">
                        <Input
                          placeholder="Search target accounts..."
                          value={targetQuery}
                          onChange={(e) => setTargetQuery(e.target.value)}
                        />
                      </div>
                      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2">
                        {targetCandidateAccountsByPlatform.length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">No accounts available.</p>
                        ) : (
                          targetCandidateAccountsByPlatform.map(({ platformId, accounts }) => {
                            const config = platformConfigs[platformId];
                            const selectedCount = accounts.filter((account) => form.targetAccounts.includes(account.id)).length;
                            const isOpen =
                              openTargetPlatforms[platformId] ??
                              (selectedCount > 0 || targetQuery.trim().length > 0);
                            return (
                              <div key={platformId} className="rounded-lg border border-border/60 bg-card/45">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                                  onClick={() =>
                                    setOpenTargetPlatforms((prev) => ({
                                      ...prev,
                                      [platformId]: !isOpen,
                                    }))
                                  }
                                >
                                  <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                                    <PlatformIcon platformId={platformId as PlatformId} size={15} />
                                    {config?.name || platformId}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {selectedCount}/{accounts.length}
                                  </span>
                                </button>
                                {isOpen && (
                                  <div className="space-y-1 border-t border-border/60 p-2">
                                    {accounts.map((account) => {
                                      const selected = form.targetAccounts.includes(account.id);
                                      const isSource = form.sourceAccounts.includes(account.id);
                                      const isConflict =
                                        selectionConflict?.accountId === account.id &&
                                        selectionConflict?.side === 'target';
                                      return (
                                        <button
                                          key={account.id}
                                          type="button"
                                          onClick={() => handleToggleTargetAccount(account.id)}
                                          className={cn(
                                            'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                            selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted',
                                            !account.isActive && 'opacity-60',
                                            isConflict && 'animate-shake bg-destructive/10 ring-2 ring-destructive/40'
                                          )}
                                        >
                                          <span className="min-w-0">
                                            <span className="truncate font-medium">
                                              {account.accountName || account.accountUsername || account.id}
                                            </span>
                                            {account.accountUsername ? (
                                              <span className="block truncate text-xs text-muted-foreground">@{account.accountUsername}</span>
                                            ) : null}
                                          </span>
                                          <span className="shrink-0 text-xs text-muted-foreground">
                                            {selected ? 'Selected' : isSource ? 'Source' : ''}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 p-4">
                      <h3 className="text-sm font-semibold text-foreground">What counts as a target?</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Targets are the accounts where the content will be published or actions executed. You can select multiple.
                      </p>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-4">
                    {targetPlatforms.map((platformId) => {
                      const meta = platformConfigs[platformId];
                      const header = meta?.name ? `${meta.name} Target Settings` : `${platformId} Target Settings`;
                      const platformAccounts = selectedTargetAccounts.filter(
                        (account) => account.platformId === platformId
                      );

                      if (platformId === 'twitter' && hasTwitterTarget) {
                        return (
                          <details key={platformId} className="rounded-xl border border-border/70 p-4" open>
                            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <PlatformIcon platformId={platformId as PlatformId} size={16} />
                                <span>{header}</span>
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Selected Twitter targets</p>
                                <SelectedAccountsInline
                                  accounts={platformAccounts}
                                  emptyText="No Twitter target accounts selected."
                                />
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {(['post', 'reply', 'quote', 'retweet', 'like'] as const).map((key) => (
                                  <label key={key} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={form.twitterActions[key]}
                                      onChange={(e) =>
                                        setForm((p) => ({
                                          ...p,
                                          twitterActions: { ...p.twitterActions, [key]: e.target.checked },
                                        }))
                                      }
                                    />
                                    {key}
                                  </label>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Applies to all selected Twitter targets.
                              </p>
                            </div>
                          </details>
                        );
                      }

                      if (platformId === 'youtube' && hasYouTubeTarget) {
                        return (
                          <details key={platformId} className="rounded-xl border border-border/70 p-4" open>
                            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <PlatformIcon platformId={platformId as PlatformId} size={16} />
                                <span>{header}</span>
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Selected YouTube targets</p>
                                <SelectedAccountsInline
                                  accounts={platformAccounts}
                                  emptyText="No YouTube target accounts selected."
                                />
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.youtubeActions.uploadVideo}
                                    onChange={(e) =>
                                      setForm((p) => ({
                                        ...p,
                                        youtubeActions: { ...p.youtubeActions, uploadVideo: e.target.checked },
                                      }))
                                    }
                                  />
                                  Upload video
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={form.youtubeActions.uploadVideoToPlaylist}
                                    onChange={(e) =>
                                      setForm((p) => ({
                                        ...p,
                                        youtubeActions: {
                                          ...p.youtubeActions,
                                          uploadVideoToPlaylist: e.target.checked,
                                        },
                                      }))
                                    }
                                  />
                                  Upload to playlist
                                </label>
                              </div>

                              {form.youtubeActions.uploadVideoToPlaylist && (
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Playlist</label>
                                  {youtubePlaylists.length > 0 ? (
                                    <Select
                                      value={form.youtubeActions.playlistId}
                                      onValueChange={(value) =>
                                        setForm((p) => ({
                                          ...p,
                                          youtubeActions: { ...p.youtubeActions, playlistId: value },
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
                                      No playlists found on selected YouTube account(s).
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
                                    value={form.youtubeVideo.titleTemplate}
                                    onChange={(e) =>
                                      setForm((p) => ({
                                        ...p,
                                        youtubeVideo: { ...p.youtubeVideo, titleTemplate: e.target.value },
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
                                    value={form.youtubeVideo.tagsText}
                                    onChange={(e) =>
                                      setForm((p) => ({
                                        ...p,
                                        youtubeVideo: { ...p.youtubeVideo, tagsText: e.target.value },
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
                                  value={form.youtubeVideo.descriptionTemplate}
                                  onChange={(e) =>
                                    setForm((p) => ({
                                      ...p,
                                      youtubeVideo: { ...p.youtubeVideo, descriptionTemplate: e.target.value },
                                    }))
                                  }
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-foreground">Privacy</label>
                                  <Select
                                    value={form.youtubeVideo.privacyStatus}
                                    onValueChange={(value: 'private' | 'unlisted' | 'public') =>
                                      setForm((p) => ({
                                        ...p,
                                        youtubeVideo: { ...p.youtubeVideo, privacyStatus: value },
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
                                  <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
                                  <Select
                                    value={form.youtubeVideo.categoryId}
                                    onValueChange={(value: string) =>
                                      setForm((p) => ({ ...p, youtubeVideo: { ...p.youtubeVideo, categoryId: value } }))
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

                              <p className="text-xs text-muted-foreground">
                                Applies to all selected YouTube targets.
                              </p>
                            </div>
                          </details>
                        );
                      }

                      if (platformId === 'telegram' && hasTelegramTarget) {
                        const anyAccountHasChatId = platformAccounts.some((a) =>
                          Boolean(String((a.credentials as any)?.chatId || '').trim())
                        );
                        return (
                          <details key={platformId} className="rounded-xl border border-border/70 p-4" open>
                            <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                              <span className="inline-flex items-center gap-2">
                                <PlatformIcon platformId={platformId as PlatformId} size={16} />
                                <span>{header}</span>
                              </span>
                            </summary>
                            <div className="mt-3 space-y-3">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Selected Telegram targets</p>
                                <SelectedAccountsInline
                                  accounts={platformAccounts}
                                  emptyText="No Telegram target accounts selected."
                                />
                              </div>

                              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                                <p className="text-xs font-medium text-muted-foreground">Chat ID resolution</p>
                                <div className="mt-2 space-y-2 text-sm">
                                  {platformAccounts.map((account) => {
                                    const chatId = String((account.credentials as any)?.chatId || '').trim();
                                    return (
                                      <div
                                        key={account.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card/60 px-3 py-2"
                                      >
                                        <span className="min-w-0 truncate font-medium">{labelAccount(account)}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {chatId ? `account chatId: ${chatId}` : 'account chatId: not set'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  If a Telegram target account has no `chatId`, the override below will be used as a fallback.
                                </p>
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-foreground">
                                  Telegram target chats (ID, @username, or link)
                                </label>
                                <div className="rounded-lg border border-border/70 bg-card/45 p-2">
                                  <div className="mb-2 flex flex-wrap gap-2">
                                    {form.telegramTargetChatIds.map((chatId) => (
                                      <span
                                        key={chatId}
                                        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs text-foreground"
                                      >
                                        {chatId}
                                        <button
                                          type="button"
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => removeTelegramChatTag('target', chatId)}
                                          aria-label={`Remove ${chatId}`}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                  <Input
                                    placeholder="Type chat id / @username / t.me link and press Enter"
                                    value={targetChatInput}
                                    onChange={(event) => setTargetChatInput(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Enter') return;
                                      event.preventDefault();
                                      const ok = addTelegramChatTag('target', targetChatInput);
                                      if (ok) setTargetChatInput('');
                                    }}
                                  />
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {anyAccountHasChatId
                                    ? 'Optional. Account chatId(s) are preferred; tags act as fallback/extra destinations.'
                                    : 'Add at least one target chat when no account chatId is saved.'}
                                </p>
                              </div>
                            </div>
                          </details>
                        );
                      }

                      return (
                        <details key={platformId} className="rounded-xl border border-border/70 p-4">
                          <summary className="cursor-pointer select-none text-sm font-semibold text-foreground">
                            <span className="inline-flex items-center gap-2">
                              <PlatformIcon platformId={platformId as PlatformId} size={16} />
                              <span>{header}</span>
                            </span>
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="mb-2 text-xs font-medium text-muted-foreground">Selected accounts</p>
                              <SelectedAccountsInline
                                accounts={platformAccounts}
                                emptyText="No accounts selected for this platform."
                              />
                            </div>
                            <ReservedSettings platformName={meta?.name || platformId} side="target" />
                          </div>
                        </details>
                      );
                    })}

                    {targetPlatforms.length === 0 && (
                      <div className="rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                        Select at least one target to configure its settings.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
                </Card>
              )}

              <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-border/70 bg-card/75 p-3 shadow-lg shadow-primary/10 backdrop-blur-xl">
                <Button variant="outline" onClick={onBack} disabled={step === 1 || isSaving}>
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {mode === 'create' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        persistDraft(form);
                        toast.success('Draft saved locally');
                      }}
                    >
                      Save draft
                    </Button>
                  )}
                  {step < 5 ? (
                    <Button onClick={onNext} disabled={isSaving}>
                      Next
                    </Button>
                  ) : mode === 'create' ? (
                    <Button
                      onClick={async () => {
                        for (let s = 1; s <= 5; s++) {
                          const err = validateStep(s, form);
                          if (err) {
                            toast.error(err);
                            setStep(s);
                            return;
                          }
                        }
                        await submitCreate(form);
                      }}
                      disabled={isSaving}
                    >
                      Create Task
                    </Button>
                  ) : (
                    <Button
                      onClick={async () => {
                        const err = validateStep(5, form);
                        if (err) return toast.error(err);
                        const ok = await saveToServer(form);
                        if (!ok) return;
                        toast.success('Task saved');
                        router.push('/tasks');
                      }}
                      disabled={isSaving}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
