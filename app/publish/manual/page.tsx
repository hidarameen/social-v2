'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PlatformIcon } from '@/components/common/platform-icon';
import { Sparkles, CalendarClock, Send, AlertTriangle, CheckCircle2, Save, Trash2 } from 'lucide-react';
import { platformConfigs } from '@/lib/platforms/configs';
import { PLATFORM_PUBLISH_RULES, validateManualPublishForPlatform } from '@/lib/manual-publish/constraints';
import { MANUAL_PUBLISH_SUGGESTIONS } from '@/lib/manual-publish/suggestions';
import type { PlatformId } from '@/lib/platforms/types';
import type {
  ManualPlatformOverride,
  ManualPublishExecutionResult,
  ManualPublishMediaType,
  ManualPublishMode,
  ManualPublishTemplate,
} from '@/lib/manual-publish/types';

type AccountItem = {
  id: string;
  platformId: PlatformId;
  accountName: string;
  accountUsername: string;
  isActive: boolean;
};

type ValidationIssue = {
  level: 'error' | 'warning';
  message: string;
};

type ValidationEntry = {
  accountId: string;
  platformId: string;
  accountName: string;
  issues: ValidationIssue[];
};

function formatLocalDateTimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default function ManualPublishPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [templates, setTemplates] = useState<ManualPublishTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<ManualPublishMediaType>('image');
  const [mode, setMode] = useState<ManualPublishMode>('now');
  const [scheduledAt, setScheduledAt] = useState<string>(
    formatLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
  );

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<PlatformId, ManualPlatformOverride>>>({});

  const [templateId, setTemplateId] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');

  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFilePreview, setUploadedFilePreview] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const [validationReport, setValidationReport] = useState<ValidationEntry[]>([]);
  const [publishResults, setPublishResults] = useState<ManualPublishExecutionResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [accountsRes, templatesRes] = await Promise.all([
          fetch('/api/accounts?limit=200&offset=0', { cache: 'no-store' }),
          fetch('/api/publish-templates', { cache: 'no-store' }),
        ]);

        const accountsData = await accountsRes.json();
        const templatesData = await templatesRes.json();

        if (!accountsRes.ok || !accountsData.success) {
          throw new Error(accountsData.error || 'Failed to load accounts');
        }
        if (!templatesRes.ok || !templatesData.success) {
          throw new Error(templatesData.error || 'Failed to load templates');
        }
        if (cancelled) return;

        setAccounts(
          (accountsData.accounts || []).map((item: any) => ({
            id: String(item.id),
            platformId: item.platformId as PlatformId,
            accountName: String(item.accountName || ''),
            accountUsername: String(item.accountUsername || ''),
            isActive: Boolean(item.isActive),
          }))
        );
        setTemplates((templatesData.templates || []) as ManualPublishTemplate[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load manual publish data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedFilePreview) {
        URL.revokeObjectURL(uploadedFilePreview);
      }
    };
  }, [uploadedFilePreview]);

  const activeAccounts = useMemo(() => accounts.filter((item) => item.isActive), [accounts]);

  const groupedAccounts = useMemo(() => {
    const map = new Map<PlatformId, AccountItem[]>();
    for (const account of activeAccounts) {
      const list = map.get(account.platformId) || [];
      list.push(account);
      map.set(account.platformId, list);
    }
    return [...map.entries()].sort((a, b) =>
      (platformConfigs[a[0]]?.name || a[0]).localeCompare(platformConfigs[b[0]]?.name || b[0])
    );
  }, [activeAccounts]);

  const selectedAccounts = useMemo(() => {
    const set = new Set(selectedAccountIds);
    return activeAccounts.filter((item) => set.has(item.id));
  }, [activeAccounts, selectedAccountIds]);

  const selectedPlatforms = useMemo(
    () => [...new Set(selectedAccounts.map((item) => item.platformId))],
    [selectedAccounts]
  );

  const scheduleDate = mode === 'schedule' && scheduledAt ? new Date(scheduledAt) : undefined;

  const previewByPlatform = useMemo(() => {
    return selectedPlatforms.map((platformId) => {
      const override = platformOverrides[platformId] || {};
      const content = trimString(override.message) || message;
      const media = trimString(override.mediaUrl) || mediaUrl;
      const type = override.mediaType || mediaType;
      const issues = validateManualPublishForPlatform({
        platformId,
        mode,
        message: content,
        mediaUrl: media,
        mediaType: type,
        scheduledAt: scheduleDate,
      });

      return {
        platformId,
        content,
        media,
        mediaType: type,
        issues,
        accountCount: selectedAccounts.filter((item) => item.platformId === platformId).length,
      };
    });
  }, [selectedPlatforms, platformOverrides, message, mediaUrl, mediaType, mode, scheduleDate, selectedAccounts]);

  const totalErrors = previewByPlatform.reduce(
    (count, item) => count + item.issues.filter((issue) => issue.level === 'error').length,
    0
  );
  const totalWarnings = previewByPlatform.reduce(
    (count, item) => count + item.issues.filter((issue) => issue.level === 'warning').length,
    0
  );

  const canSubmit = selectedAccounts.length > 0 && !isPublishing && !isValidating && !isUploadingMedia;

  function toggleAccount(accountId: string, checked: boolean) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(accountId);
      else next.delete(accountId);
      return [...next];
    });
  }

  function updatePlatformOverride(platformId: PlatformId, patch: Partial<ManualPlatformOverride>) {
    setPlatformOverrides((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  async function reloadTemplates() {
    const res = await fetch('/api/publish-templates', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load templates');
    }
    setTemplates(data.templates || []);
  }

  function applyTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (!template) return;
    const activeAccountIdSet = new Set(activeAccounts.map((item) => item.id));
    const validTemplateAccountIds = (template.defaultAccountIds || []).filter((id) => activeAccountIdSet.has(id));
    const skippedCount = (template.defaultAccountIds || []).length - validTemplateAccountIds.length;

    setMessage(template.message || '');
    setMediaUrl(template.mediaUrl || '');
    setMediaType(template.mediaType || 'image');
    setSelectedAccountIds(validTemplateAccountIds);
    setPlatformOverrides(template.platformOverrides || {});
    toast.success(
      skippedCount > 0
        ? `Template "${template.name}" applied (${skippedCount} unavailable account(s) skipped)`
        : `Template "${template.name}" applied`
    );
  }

  async function uploadMediaFile(file: File) {
    try {
      setIsUploadingMedia(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/manual-publish/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload media');
      }

      if (typeof data.url === 'string' && data.url.trim()) {
        setMediaUrl(data.url.trim());
      }
      toast.success('Media uploaded and linked to composer.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload media');
    } finally {
      setIsUploadingMedia(false);
    }
  }

  async function saveTemplate() {
    try {
      const name = newTemplateName.trim();
      if (!name) {
        toast.error('Enter a template name first.');
        return;
      }

      const res = await fetch('/api/publish-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: trimString(newTemplateDescription) || undefined,
          message,
          mediaUrl: trimString(mediaUrl) || undefined,
          mediaType,
          defaultAccountIds: selectedAccountIds,
          platformOverrides,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save template');
      }

      await reloadTemplates();
      setTemplateId(data.template?.id || '');
      setNewTemplateName('');
      setNewTemplateDescription('');
      toast.success('Template saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save template');
    }
  }

  async function deleteTemplate() {
    if (!templateId) {
      toast.error('Select a template to delete.');
      return;
    }

    try {
      const res = await fetch(`/api/publish-templates/${templateId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }
      await reloadTemplates();
      setTemplateId('');
      toast.success('Template deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete template');
    }
  }

  function buildPublishPayload(dryRun: boolean, options?: { checkConnectivity?: boolean }) {
    const scheduleValue =
      mode === 'schedule'
        ? (() => {
            const parsed = new Date(scheduledAt);
            return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
          })()
        : undefined;

    return {
      message,
      mediaUrl: trimString(mediaUrl) || undefined,
      mediaType,
      accountIds: selectedAccountIds,
      mode,
      scheduledAt: scheduleValue,
      platformOverrides,
      dryRun,
      checkConnectivity: dryRun ? Boolean(options?.checkConnectivity) : undefined,
    };
  }

  async function runValidation() {
    try {
      setIsValidating(true);
      const res = await fetch('/api/manual-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPublishPayload(true, { checkConnectivity: true })),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Validation failed');
      }
      setValidationReport((data.validation || []) as ValidationEntry[]);
      toast.success(data.success ? 'Validation passed' : 'Validation completed with issues');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to validate post');
    } finally {
      setIsValidating(false);
    }
  }

  async function publishNow() {
    try {
      setIsPublishing(true);
      const res = await fetch('/api/manual-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPublishPayload(false)),
      });
      const data = await res.json();
      setPublishResults((data.results || []) as ManualPublishExecutionResult[]);
      setValidationReport((data.validation || []) as ValidationEntry[]);
      if (!res.ok) {
        throw new Error(data.error || 'Publishing failed');
      }

      const succeededCount = Number(data.succeededCount || 0);
      const failedCount = Number(data.failedCount || 0);
      if (data.success) {
        toast.success(mode === 'schedule' ? 'All posts scheduled successfully' : 'All posts published successfully');
      } else if (data.partialSuccess) {
        toast.warning(`Partial success: ${succeededCount} succeeded, ${failedCount} failed.`);
      } else {
        toast.error(data.error || `Publish failed for ${failedCount} account(s).`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish');
    } finally {
      setIsPublishing(false);
    }
  }

  const visibleSuggestions = MANUAL_PUBLISH_SUGGESTIONS.slice(0, 24);

  return (
    <div className="min-h-screen bg-background control-app dashboard-shell-bg">
      <Sidebar />
      <Header />

      <main className="control-main premium-main">
        <div className="page-header premium-page-header animate-fade-up">
          <div>
            <p className="kpi-pill mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={12} />
              Buffer Manual Composer
            </p>
            <h1 className="page-title">Manual Publish</h1>
            <p className="page-subtitle">
              Compose once, customize per platform, validate constraints, then publish now or schedule.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runValidation} disabled={!canSubmit}>
              <CheckCircle2 size={16} className="mr-2" />
              Validate & Test Accounts
            </Button>
            <Button onClick={publishNow} disabled={!canSubmit || totalErrors > 0}>
              <Send size={16} className="mr-2" />
              {isPublishing ? 'Publishing...' : mode === 'schedule' ? 'Schedule' : 'Publish Now'}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card className="surface-card">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading manual publishing workspace...</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Composer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Write your post..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">Media URL</label>
                    <Input
                      placeholder="https://cdn.example.com/media.jpg"
                      value={mediaUrl}
                      onChange={(event) => setMediaUrl(event.target.value)}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Buffer publishing needs public media URLs. Upload below to generate a public URL automatically.
                    </p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Media Type</label>
                    <Select value={mediaType} onValueChange={(value) => setMediaType(value as ManualPublishMediaType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="link">Link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-card/45 p-3">
                  <label className="mb-2 block text-sm font-medium text-foreground">Upload Media (Preview)</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    disabled={isUploadingMedia}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        setUploadedFileName('');
                        setUploadedFilePreview('');
                        return;
                      }
                      if (uploadedFilePreview) {
                        URL.revokeObjectURL(uploadedFilePreview);
                      }
                      setUploadedFileName(file.name);
                      const previewUrl = URL.createObjectURL(file);
                      setUploadedFilePreview(previewUrl);
                      if (file.type.startsWith('video/')) setMediaType('video');
                      if (file.type.startsWith('image/')) setMediaType('image');
                      await uploadMediaFile(file);
                    }}
                  />
                  {uploadedFileName ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected file: {uploadedFileName}
                      {isUploadingMedia ? ' (uploading...)' : ''}
                    </p>
                  ) : null}
                  {mediaUrl ? <p className="mt-1 text-xs text-muted-foreground break-all">Linked media URL: {mediaUrl}</p> : null}
                  {uploadedFilePreview ? (
                    <div className="mt-3">
                      {mediaType === 'video' ? (
                        <video src={uploadedFilePreview} controls className="max-h-52 w-full rounded-md border border-border/60" />
                      ) : (
                        <img src={uploadedFilePreview} alt="Preview upload" className="max-h-52 w-full rounded-md border border-border/60 object-cover" />
                      )}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock size={18} />
                  Publish Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Mode</label>
                    <Select value={mode} onValueChange={(value) => setMode(value as ManualPublishMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="now">Publish now</SelectItem>
                        <SelectItem value="schedule">Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {mode === 'schedule' ? (
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-foreground">Schedule time</label>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(event) => setScheduledAt(event.target.value)}
                      />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Target Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {groupedAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No connected active accounts found.</p>
                ) : (
                  <div className="space-y-4">
                    {groupedAccounts.map(([platformId, platformAccounts]) => (
                      <div key={platformId} className="rounded-xl border border-border/60 p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <PlatformIcon platformId={platformId} size={18} />
                          <p className="font-medium">{platformConfigs[platformId]?.name || platformId}</p>
                          <Badge variant="outline">{platformAccounts.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          {platformAccounts.map((account) => {
                            const checked = selectedAccountIds.includes(account.id);
                            return (
                              <label
                                key={account.id}
                                className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(event) => toggleAccount(account.id, event.target.checked)}
                                />
                                <span className="font-medium">{account.accountName}</span>
                                <span className="text-muted-foreground">@{account.accountUsername}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">Apply template</label>
                    <Select value={templateId} onValueChange={applyTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a saved template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={deleteTemplate}
                      disabled={!templateId}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Template name</label>
                    <Input
                      placeholder="Launch campaign"
                      value={newTemplateName}
                      onChange={(event) => setNewTemplateName(event.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-foreground">Description</label>
                    <Input
                      placeholder="Optional"
                      value={newTemplateDescription}
                      onChange={(event) => setNewTemplateDescription(event.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={saveTemplate}>
                  <Save size={16} className="mr-2" />
                  Save Current as Template
                </Button>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Platform-Specific Overrides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPlatforms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select accounts first to configure platform overrides.</p>
                ) : (
                  selectedPlatforms.map((platformId) => {
                    const current = platformOverrides[platformId] || {};
                    return (
                      <div key={platformId} className="rounded-xl border border-border/60 p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <PlatformIcon platformId={platformId} size={18} />
                          <p className="font-medium">{platformConfigs[platformId]?.name || platformId}</p>
                          <Badge variant="outline">
                            max {PLATFORM_PUBLISH_RULES[platformId].maxChars}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Optional override message"
                            value={current.message || ''}
                            onChange={(event) =>
                              updatePlatformOverride(platformId, { message: event.target.value || undefined })
                            }
                            rows={4}
                          />
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Input
                              placeholder="Optional override media URL"
                              value={current.mediaUrl || ''}
                              onChange={(event) =>
                                updatePlatformOverride(platformId, { mediaUrl: event.target.value || undefined })
                              }
                            />
                            <Select
                              value={current.mediaType || 'image'}
                              onValueChange={(value) =>
                                updatePlatformOverride(platformId, { mediaType: value as ManualPublishMediaType })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="image">Image</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="link">Link</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Per-Platform Preview & Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="kpi-pill">{selectedAccountIds.length} selected accounts</span>
                  <span className="kpi-pill">{selectedPlatforms.length} platforms</span>
                  <span className="kpi-pill">{totalWarnings} warnings</span>
                  <span className="kpi-pill">{totalErrors} errors</span>
                </div>
                {previewByPlatform.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select at least one account to see previews.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {previewByPlatform.map((preview) => {
                      const rule = PLATFORM_PUBLISH_RULES[preview.platformId];
                      return (
                        <div key={preview.platformId} className="rounded-xl border border-border/60 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platformId={preview.platformId} size={18} />
                              <p className="font-medium">{platformConfigs[preview.platformId]?.name || preview.platformId}</p>
                            </div>
                            <Badge variant="outline">{preview.accountCount} account(s)</Badge>
                          </div>
                          <p className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm whitespace-pre-wrap">
                            {preview.content || '(no text)'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{preview.content.length}/{rule.maxChars} chars</span>
                            <span>Media: {preview.media ? `${preview.mediaType}` : 'none'}</span>
                            {preview.media ? <span className="truncate max-w-[220px]">{preview.media}</span> : null}
                          </div>
                          {preview.issues.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {preview.issues.map((issue, idx) => (
                                <div
                                  key={`${preview.platformId}-${idx}`}
                                  className={`flex items-start gap-2 rounded-md border px-2 py-1 text-xs ${
                                    issue.level === 'error'
                                      ? 'border-destructive/60 text-destructive'
                                      : 'border-amber-400/60 text-amber-600'
                                  }`}
                                >
                                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                  <span>{issue.message}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-emerald-600">No validation issues.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {validationReport.length > 0 ? (
              <Card className="surface-card">
                <CardHeader>
                  <CardTitle>Validation Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {validationReport.map((entry) => (
                    <div key={entry.accountId} className="rounded-lg border border-border/60 p-2">
                      <p className="text-sm font-medium">
                        {entry.accountName} ({entry.platformId})
                      </p>
                      {entry.issues.length === 0 ? (
                        <p className="text-xs text-emerald-600">No issues</p>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {entry.issues.map((issue, idx) => (
                            <p key={`${entry.accountId}-${idx}`} className="text-xs">
                              [{issue.level}] {issue.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {publishResults.length > 0 ? (
              <Card className="surface-card">
                <CardHeader>
                  <CardTitle>Publish Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {publishResults.map((result) => (
                    <div key={`${result.accountId}-${result.platformId}`} className="rounded-lg border border-border/60 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {result.accountName} ({result.platformId})
                        </p>
                        {result.success ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 size={14} />
                            Success
                          </span>
                        ) : (
                          <span className="text-xs text-destructive">Failed</span>
                        )}
                      </div>
                      {result.postId ? <p className="text-xs text-muted-foreground">Post ID: {result.postId}</p> : null}
                      {result.url ? (
                        <a href={result.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          Open post
                        </a>
                      ) : null}
                      {result.scheduledFor ? (
                        <p className="text-xs text-muted-foreground">
                          Scheduled for: {new Date(result.scheduledFor).toLocaleString()}
                        </p>
                      ) : null}
                      {result.error ? <p className="text-xs text-destructive">{result.error}</p> : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="surface-card">
              <CardHeader>
                <CardTitle>Enhancement Backlog (Benchmarked)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {visibleSuggestions.map((item, index) => (
                    <p key={index} className="rounded-md border border-border/60 px-2 py-1 text-sm">
                      {item}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
