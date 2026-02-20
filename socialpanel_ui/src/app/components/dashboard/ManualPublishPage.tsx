import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { apiRequest, getMobileAccessToken } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { AdaptationEngineSection } from "./manual-publish/AdaptationEngineSection";
import { ExecutionResultsSection } from "./manual-publish/ExecutionResultsSection";
import {
  buildAdaptationEntries,
  formatFileSize,
  hashtagsFromInput,
  inferMediaKind,
  isPlatformType,
  manualPublishRequest,
  toDateTimeLocal,
  trim,
} from "./manual-publish/helpers";
import { TemplateLibrarySection } from "./manual-publish/TemplateLibrarySection";
import {
  DRAFT_STORAGE_KEY,
  type AccountOption,
  type ManualPlatformOverride,
  type ManualPlatformTemplateSettings,
  type ManualPublishMode,
  type ManualPublishResponse,
  type ManualTemplate,
  type ManualValidationEntry,
  type UploadResponse,
  type UploadedMedia,
} from "./manual-publish/types";

function getAccountDisplayName(account: AccountOption): string {
  return trim(account.accountName) || trim(account.accountUsername) || account.id;
}

export function ManualPublishPage() {
  const { language, t } = useTheme();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountSearch, setAccountSearch] = useState("");

  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const [composerOpen, setComposerOpen] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [mode, setMode] = useState<ManualPublishMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [checkConnectivity, setCheckConnectivity] = useState(true);

  const [overridesEnabled, setOverridesEnabled] = useState(true);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<PlatformType, ManualPlatformOverride>>>({});
  const [platformSettings, setPlatformSettings] = useState<Partial<Record<PlatformType, ManualPlatformTemplateSettings>>>({});

  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [lastValidation, setLastValidation] = useState<ManualValidationEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<ManualPublishResponse | null>(null);
  const [localValidationTouched, setLocalValidationTouched] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      try {
        const payload = await apiRequest<any>("/api/accounts?limit=200&offset=0&sortBy=createdAt&sortDir=desc");
        if (!active) return;
        const mapped: AccountOption[] = [];
        for (const raw of (payload.accounts || []) as any[]) {
          const platformId = trim(raw.platformId);
          const id = trim(raw.id);
          if (!id || !isPlatformType(platformId)) continue;
          mapped.push({
            id,
            platformId,
            accountName: trim(raw.accountName),
            accountUsername: trim(raw.accountUsername) || undefined,
            isActive: Boolean(raw.isActive),
          });
        }
        setAccounts(mapped);
      } catch {
        if (!active) return;
        setAccounts([]);
      } finally {
        if (active) setAccountsLoading(false);
      }
    }

    async function loadTemplates() {
      try {
        const payload = await apiRequest<any>("/api/publish-templates");
        if (!active) return;
        const list = Array.isArray(payload.templates) ? (payload.templates as ManualTemplate[]) : [];
        setTemplates(list);
      } catch {
        if (!active) return;
        setTemplates([]);
      } finally {
        if (active) setTemplatesLoading(false);
      }
    }

    void Promise.all([loadAccounts(), loadTemplates()]);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "enter") {
        event.preventDefault();
        if (!publishLoading && !dryRunLoading) {
          void runPublish();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );

  const accountsByPlatform = useMemo(() => {
    const grouped: Partial<Record<PlatformType, AccountOption[]>> = {};
    for (const account of accounts) {
      if (!grouped[account.platformId]) grouped[account.platformId] = [];
      grouped[account.platformId]!.push(account);
    }
    return grouped;
  }, [accounts]);

  const filteredAccountsByPlatform = useMemo(() => {
    const query = trim(accountSearch).toLowerCase();
    if (!query) return accountsByPlatform;
    const grouped: Partial<Record<PlatformType, AccountOption[]>> = {};
    for (const platformId of Object.keys(accountsByPlatform) as PlatformType[]) {
      const list = accountsByPlatform[platformId] || [];
      const filtered = list.filter((account) => {
        const label = `${account.accountName} ${account.accountUsername || ""}`.toLowerCase();
        return label.includes(query);
      });
      if (filtered.length > 0) grouped[platformId] = filtered;
    }
    return grouped;
  }, [accountSearch, accountsByPlatform]);

  const selectedPlatforms = useMemo(() => {
    return [...new Set(selectedAccounts.map((account) => account.platformId))] as PlatformType[];
  }, [selectedAccounts]);

  const localAdaptationEntries = useMemo(
    () =>
      buildAdaptationEntries({
        selectedPlatforms,
        baseMessage: message,
        mode,
        scheduledAt,
        media,
        platformOverrides,
        platformSettings,
      }),
    [selectedPlatforms, message, mode, scheduledAt, media, platformOverrides, platformSettings]
  );

  const localAdaptationSummary = useMemo(() => {
    const errorCount = localAdaptationEntries.reduce(
      (sum, entry) => sum + entry.issues.filter((issue) => issue.level === "error").length,
      0
    );
    const warningCount = localAdaptationEntries.reduce(
      (sum, entry) => sum + entry.issues.filter((issue) => issue.level === "warning").length,
      0
    );
    return { errorCount, warningCount };
  }, [localAdaptationEntries]);

  const canSend = selectedAccountIds.length > 0 && (trim(message).length > 0 || Boolean(media));
  const dirty =
    trim(message).length > 0 ||
    Boolean(media) ||
    selectedAccountIds.length > 0 ||
    Object.keys(platformOverrides).length > 0 ||
    mode === "schedule";

  useEffect(() => {
    if (!templatesLoading && !accountsLoading) {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            message?: string;
            media?: UploadedMedia | null;
            selectedAccountIds?: string[];
            mode?: ManualPublishMode;
            scheduledAt?: string;
            platformOverrides?: Partial<Record<PlatformType, ManualPlatformOverride>>;
            platformSettings?: Partial<Record<PlatformType, ManualPlatformTemplateSettings>>;
          };
          setMessage(trim(parsed.message));
          setMedia(parsed.media || null);
          setSelectedAccountIds(Array.isArray(parsed.selectedAccountIds) ? parsed.selectedAccountIds : []);
          setMode(parsed.mode === "schedule" ? "schedule" : "now");
          setScheduledAt(trim(parsed.scheduledAt));
          setPlatformOverrides(parsed.platformOverrides || {});
          setPlatformSettings(parsed.platformSettings || {});
          setLocalValidationTouched(true);
          return;
        } catch {
          // ignore invalid draft
        }
      }

      const defaultTemplate = templates.find((item) => item.isDefault);
      if (defaultTemplate) {
        applyTemplate(defaultTemplate, false);
      }
    }
  }, [templatesLoading, accountsLoading]);

  useEffect(() => {
    if (!dirty) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const payload = {
      message,
      media,
      selectedAccountIds,
      mode,
      scheduledAt,
      platformOverrides,
      platformSettings,
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [dirty, message, media, selectedAccountIds, mode, scheduledAt, platformOverrides, platformSettings]);

  useEffect(() => {
    return () => {
      if (media?.localPreviewUrl) {
        URL.revokeObjectURL(media.localPreviewUrl);
      }
    };
  }, [media?.localPreviewUrl]);

  function toggleAccount(accountId: string) {
    setLocalValidationTouched(true);
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  function togglePlatform(platformId: PlatformType) {
    const platformAccountIds = (filteredAccountsByPlatform[platformId] || []).map((item) => item.id);
    if (platformAccountIds.length === 0) return;
    const allSelected = platformAccountIds.every((id) => selectedAccountIds.includes(id));
    setLocalValidationTouched(true);
    setSelectedAccountIds((prev) => {
      if (allSelected) return prev.filter((id) => !platformAccountIds.includes(id));
      return [...new Set([...prev, ...platformAccountIds])];
    });
  }

  function updateOverride(platformId: PlatformType, patch: Partial<ManualPlatformOverride>) {
    setLocalValidationTouched(true);
    setPlatformOverrides((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  function clearOverride(platformId: PlatformType) {
    setPlatformOverrides((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  }

  function updatePlatformSettings(platformId: PlatformType, patch: Partial<ManualPlatformTemplateSettings>) {
    setPlatformSettings((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  function clearPlatformSettings(platformId: PlatformType) {
    setPlatformSettings((prev) => {
      const next = { ...prev };
      delete next[platformId];
      return next;
    });
  }

  function getComposedMessage(platformId: PlatformType): string {
    const override = platformOverrides[platformId];
    const settings = platformSettings[platformId];
    const body = trim(override?.message) || trim(message);
    const hashtags = settings?.defaultHashtags || [];
    if (hashtags.length === 0) return body;
    const hashtagLine = hashtags.map((tag) => `#${tag}`).join(" ");
    return `${body}\n\n${hashtagLine}`.trim();
  }

  function buildPayload(extra: { dryRun: boolean }) {
    const payload: Record<string, unknown> = {
      message,
      mediaUrl: media?.url || undefined,
      mediaType: media?.kind,
      accountIds: selectedAccountIds,
      mode,
      dryRun: extra.dryRun,
      checkConnectivity: extra.dryRun ? checkConnectivity : undefined,
    };

    if (mode === "schedule") {
      const date = new Date(scheduledAt);
      payload.scheduledAt = Number.isNaN(date.getTime()) ? scheduledAt : date.toISOString();
    }

    if (overridesEnabled) {
      const sanitized: Partial<Record<PlatformType, ManualPlatformOverride>> = {};
      for (const platformId of selectedPlatforms) {
        const composed = getComposedMessage(platformId);
        const next: ManualPlatformOverride = {
          message: composed || undefined,
          mediaUrl: media?.url,
          mediaType: media?.kind,
        };
        if (next.message || next.mediaUrl || next.mediaType) {
          sanitized[platformId] = next;
        }
      }
      if (Object.keys(sanitized).length > 0) {
        payload.platformOverrides = sanitized;
      }
    }

    return payload;
  }

  function hydrateTemplateEditor(template?: ManualTemplate) {
    if (!template) {
      setTemplateName("");
      setTemplateDescription("");
      setTemplateIsDefault(false);
      setEditingTemplateId(null);
      return;
    }
    setTemplateName(template.name || "");
    setTemplateDescription(template.description || "");
    setTemplateIsDefault(Boolean(template.isDefault));
    setEditingTemplateId(template.id);
  }

  function applyTemplate(template: ManualTemplate, toastEnabled = true) {
    setSelectedTemplateId(template.id);
    setMessage(template.message || "");
    setSelectedAccountIds(Array.isArray(template.defaultAccountIds) ? template.defaultAccountIds : []);
    setPlatformOverrides(template.platformOverrides || {});
    setPlatformSettings(template.platformSettings || {});

    const mediaKind = inferMediaKind(template.mediaUrl || "", template.mediaType);
    if (template.mediaUrl && mediaKind) {
      setMedia({
        url: template.mediaUrl,
        kind: mediaKind,
        mimeType: template.mediaType === "image" ? "image/*" : template.mediaType === "video" ? "video/*" : undefined,
      });
    } else {
      setMedia(null);
    }

    if (toastEnabled) {
      toast.success(t("تم تطبيق قالب النشر", "Template applied."));
    }
  }

  function upsertTemplate(template: ManualTemplate) {
    setTemplates((prev) => {
      const next = prev.filter((item) => item.id !== template.id);
      next.unshift(template);
      const normalized = next.map((item) => ({ ...item, isDefault: template.isDefault ? item.id === template.id : item.isDefault }));
      if (!normalized.some((item) => item.isDefault) && normalized.length > 0) {
        normalized[0] = { ...normalized[0], isDefault: true };
      }
      return normalized;
    });
  }

  async function runDryRun() {
    setLocalValidationTouched(true);
    if (!canSend) {
      toast.error(t("Select accounts and add text or media.", "Select accounts and add text or media."));
      return;
    }

    try {
      setDryRunLoading(true);
      const response = await manualPublishRequest(buildPayload({ dryRun: true }));
      setLastValidation(Array.isArray(response.validation) ? response.validation : []);
      setLastResponse(response);

      const hasErrors = (response.validation || []).some((entry) =>
        entry.issues.some((issue) => issue.level === "error")
      );

      if (hasErrors) {
        toast.error(t("Cross-platform check found blocking issues.", "Cross-platform check found blocking issues."));
      } else {
        toast.success(t("Cross-platform check passed.", "Cross-platform check passed."));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Dry run failed.", "Dry run failed."));
    } finally {
      setDryRunLoading(false);
    }
  }

  async function runPublish() {
    setLocalValidationTouched(true);
    if (!canSend) {
      toast.error(t("Select accounts and add text or media.", "Select accounts and add text or media."));
      return;
    }

    if (mode === "schedule" && !trim(scheduledAt)) {
      toast.error(t("Select a valid schedule time.", "Select a valid schedule time."));
      return;
    }

    if (localAdaptationSummary.errorCount > 0) {
      toast.error(t("Fix adaptation errors before publishing.", "Fix adaptation errors before publishing."));
      return;
    }

    try {
      setPublishLoading(true);
      const response = await manualPublishRequest(buildPayload({ dryRun: false }));
      setLastValidation(Array.isArray(response.validation) ? response.validation : []);
      setLastResponse(response);

      if (response.success) {
        toast.success(
          t(
            `Published to ${response.succeededCount || 0} account(s).`,
            `Published to ${response.succeededCount || 0} account(s).`
          )
        );
        return;
      }

      if (response.partialSuccess) {
        toast.warning(
          t(
            `Partial success: ${response.succeededCount || 0} succeeded, ${response.failedCount || 0} failed.`,
            `Partial success: ${response.succeededCount || 0} succeeded, ${response.failedCount || 0} failed.`
          )
        );
        return;
      }

      toast.error(response.error || t("Publish failed.", "Publish failed."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Publish failed.", "Publish failed."));
    } finally {
      setPublishLoading(false);
    }
  }

  async function uploadMedia(file: File) {
    try {
      setUploadLoading(true);
      const token = getMobileAccessToken();
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/manual-publish/upload", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as UploadResponse;
      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(trim(payload.error) || `Upload failed: ${response.status}`);
      }

      const kind = trim(payload.mimeType).startsWith("video/") ? "video" : "image";
      if (media?.localPreviewUrl) URL.revokeObjectURL(media.localPreviewUrl);
      setMedia({
        url: payload.url,
        kind,
        mimeType: payload.mimeType,
        fileName: payload.fileName || file.name,
        size: payload.size || file.size,
        localPreviewUrl: URL.createObjectURL(file),
      });

      setLocalValidationTouched(true);
      toast.success(t("Media uploaded successfully.", "Media uploaded successfully."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Upload failed.", "Upload failed."));
    } finally {
      setUploadLoading(false);
    }
  }

  async function saveTemplate() {
    const name = trim(templateName);
    if (!name) {
      toast.error(t("Template name is required.", "Template name is required."));
      return;
    }

    const payload = {
      name,
      description: trim(templateDescription) || undefined,
      isDefault: templateIsDefault,
      message,
      mediaUrl: media?.url || undefined,
      mediaType: media?.kind,
      defaultAccountIds: selectedAccountIds,
      platformOverrides,
      platformSettings,
    };

    try {
      setTemplateSaving(true);
      if (editingTemplateId) {
        const response = await apiRequest<any>(`/api/publish-templates/${encodeURIComponent(editingTemplateId)}`, {
          method: "PATCH",
          body: payload,
        });
        const updated = response.template as ManualTemplate;
        upsertTemplate(updated);
        setSelectedTemplateId(updated.id);
        toast.success(t("Template updated.", "Template updated."));
      } else {
        const response = await apiRequest<any>("/api/publish-templates", {
          method: "POST",
          body: payload,
        });
        const created = response.template as ManualTemplate;
        upsertTemplate(created);
        setSelectedTemplateId(created.id);
        toast.success(t("Template created.", "Template created."));
      }

      hydrateTemplateEditor();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to save template.", "Failed to save template."));
    } finally {
      setTemplateSaving(false);
    }
  }

  async function setTemplateAsDefault(templateId: string) {
    try {
      setTemplateBusyId(templateId);
      const response = await apiRequest<any>(`/api/publish-templates/${encodeURIComponent(templateId)}`, {
        method: "PATCH",
        body: { isDefault: true },
      });
      const updated = response.template as ManualTemplate;
      setTemplates((prev) =>
        prev
          .map((item) => ({ ...item, isDefault: item.id === updated.id }))
          .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)))
      );
      toast.success(t("Default template updated.", "Default template updated."));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("Failed to set default template.", "Failed to set default template.")
      );
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function deleteTemplate(templateId: string) {
    try {
      setTemplateBusyId(templateId);
      const token = getMobileAccessToken();
      const response = await fetch(`/api/publish-templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(trim(payload?.error) || `Delete failed: ${response.status}`);
      }

      setTemplates((prev) => {
        const next = prev.filter((item) => item.id !== templateId);
        if (next.length > 0 && !next.some((item) => item.isDefault)) {
          next[0] = { ...next[0], isDefault: true };
        }
        return next;
      });

      if (selectedTemplateId === templateId) setSelectedTemplateId("");
      if (editingTemplateId === templateId) hydrateTemplateEditor();
      toast.success(t("Template deleted.", "Template deleted."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to delete template.", "Failed to delete template."));
    } finally {
      setTemplateBusyId(null);
    }
  }

  function resetComposer() {
    setMessage("");
    setMedia(null);
    setSelectedAccountIds([]);
    setMode("now");
    setScheduledAt("");
    setPlatformOverrides({});
    setPlatformSettings({});
    setLastValidation([]);
    setLastResponse(null);
    setSelectedTemplateId("");
    setLocalValidationTouched(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  const scheduleQuickActions = [
    { label: t("+1h", "+1h"), value: 1 },
    { label: t("+3h", "+3h"), value: 3 },
    { label: t("Tomorrow", "Tomorrow"), value: 24 },
  ];

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <motion.section
        className="rounded-2xl p-5 sm:p-6"
        style={{
          border: "1px solid rgba(99,102,241,0.15)",
          background: "linear-gradient(140deg, rgba(255,255,255,0.92), rgba(245,247,255,0.96), rgba(240,248,255,0.98))",
          boxShadow: "0 12px 40px rgba(79,70,229,0.08)",
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span className="text-indigo-700" style={{ fontSize: "0.75rem" }}>
                {t("Manual Publishing Engine", "Manual Publishing Engine")}
              </span>
            </div>
            <h2 className="text-slate-800" style={{ fontSize: "1.2rem", fontFamily: "Cairo, sans-serif" }}>
              {t("Cross-Platform Composer", "Cross-Platform Composer")}
            </h2>
            <p className="text-slate-500 mt-1" style={{ fontSize: "0.82rem" }}>
              {t(
                "Compose once, adapt per platform, validate constraints, preview professionally, then publish or schedule.",
                "Compose once, adapt per platform, validate constraints, preview professionally, then publish or schedule."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen((prev) => !prev)}
              className="px-3.5 py-2.5 rounded-xl bg-white text-slate-700 inline-flex items-center gap-2"
              style={{ border: "1px solid rgba(15,23,42,0.12)", fontSize: "0.78rem" }}
            >
              {composerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>{composerOpen ? t("Hide composer", "Hide composer") : t("Publish Post", "Publish Post")}</span>
            </button>

            <button
              onClick={runDryRun}
              disabled={dryRunLoading || publishLoading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center gap-2 disabled:opacity-50"
              style={{ fontSize: "0.78rem" }}
            >
              {dryRunLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              <span>{t("Run Validation", "Run Validation")}</span>
            </button>

            <button
              onClick={runPublish}
              disabled={publishLoading || dryRunLoading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white inline-flex items-center gap-2 disabled:opacity-50"
              style={{ fontSize: "0.78rem", boxShadow: "0 8px 24px rgba(15,23,42,0.2)" }}
            >
              {publishLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{mode === "schedule" ? t("Schedule", "Schedule") : t("Publish Now", "Publish Now")}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-slate-500" style={{ fontSize: "0.75rem" }}>
          <span className="px-2.5 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(15,23,42,0.08)" }}>
            {t("Selected accounts", "Selected accounts")}: {selectedAccountIds.length}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(15,23,42,0.08)" }}>
            {t("Platforms", "Platforms")}: {selectedPlatforms.length}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(15,23,42,0.08)" }}>
            {t("Shortcut", "Shortcut")}: Ctrl/Cmd + Enter
          </span>
          {dirty ? (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700" style={{ border: "1px solid rgba(245,158,11,0.25)" }}>
              {t("Draft autosaved", "Draft autosaved")}
            </span>
          ) : null}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-5">
          <AnimatePresence initial={false}>
            {composerOpen ? (
              <motion.section
                key="composer"
                className="rounded-2xl bg-white p-5 sm:p-6"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                    {t("Post Composer", "Post Composer")}
                  </h3>
                  <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                    {message.length} {t("chars", "chars")}
                  </span>
                </div>

                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setLocalValidationTouched(true);
                  }}
                  rows={6}
                  placeholder={t("Write your post content here...", "Write your post content here...")}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
                  style={{ fontSize: "0.9rem", minHeight: 170 }}
                />

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl p-4 bg-slate-50/80"
                    style={{ border: "1px dashed rgba(99,102,241,0.35)" }}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (file) void uploadMedia(file);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-700" style={{ fontSize: "0.82rem" }}>
                          {t("Media Attachment", "Media Attachment")}
                        </p>
                        <p className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                          {t("Upload image/video (no URL field, auto-detected)", "Upload image/video (no URL field, auto-detected)")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                        className="px-3 py-2 rounded-lg bg-white text-slate-700 inline-flex items-center gap-1.5 disabled:opacity-50"
                        style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.72rem" }}
                      >
                        {uploadLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{t("Upload", "Upload")}</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,video/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadMedia(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>

                    {media ? (
                      <div className="mt-3 rounded-xl bg-white p-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {media.kind === "image" ? (
                              <img
                                src={media.localPreviewUrl || media.url}
                                alt="uploaded-media"
                                className="w-14 h-14 rounded-lg object-cover"
                              />
                            ) : (
                              <video
                                src={media.localPreviewUrl || media.url}
                                className="w-14 h-14 rounded-lg object-cover bg-slate-900"
                                muted
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-slate-700 truncate" style={{ fontSize: "0.75rem" }}>
                                {media.fileName || trim(media.url).split("/").pop() || "media"}
                              </p>
                              <p className="text-slate-400" style={{ fontSize: "0.68rem" }}>
                                {media.kind.toUpperCase()} {media.size ? `• ${formatFileSize(media.size)}` : ""}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (media.localPreviewUrl) URL.revokeObjectURL(media.localPreviewUrl);
                              setMedia(null);
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl p-4 bg-slate-50/80" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-slate-700 mb-2" style={{ fontSize: "0.82rem" }}>
                      {t("Publishing Time", "Publishing Time")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setMode("now")}
                        className={`px-3 py-2.5 rounded-xl ${mode === "now" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                        style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.74rem" }}
                      >
                        {t("Now", "Now")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode("schedule");
                          if (!scheduledAt) setScheduledAt(toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000)));
                        }}
                        className={`px-3 py-2.5 rounded-xl ${mode === "schedule" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                        style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.74rem" }}
                      >
                        {t("Schedule", "Schedule")}
                      </button>
                    </div>

                    {mode === "schedule" ? (
                      <>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(event) => {
                            setScheduledAt(event.target.value);
                            setLocalValidationTouched(true);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700"
                          style={{ fontSize: "0.75rem" }}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {scheduleQuickActions.map((item) => (
                            <button
                              key={String(item.value)}
                              type="button"
                              onClick={() => {
                                const next = new Date(Date.now() + item.value * 60 * 60 * 1000);
                                setScheduledAt(toDateTimeLocal(next));
                                setMode("schedule");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white text-slate-600"
                              style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.68rem" }}
                            >
                              <Clock3 className="w-3 h-3 inline-block mr-1" />
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    <label className="mt-3 flex items-center gap-2 text-slate-500" style={{ fontSize: "0.72rem" }}>
                      <input
                        type="checkbox"
                        checked={checkConnectivity}
                        onChange={(event) => setCheckConnectivity(event.target.checked)}
                      />
                      <span>{t("Check account connectivity during dry-run", "Check account connectivity during dry-run")}</span>
                    </label>
                  </div>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>

          <motion.section
            className="rounded-2xl bg-white p-5 sm:p-6"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                {t("Target Accounts", "Target Accounts")}
              </h3>
              <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                {selectedAccountIds.length} {t("selected", "selected")}
              </span>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder={t("Search accounts...", "Search accounts...")}
                className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                style={{ fontSize: "0.78rem" }}
              />
            </div>

            {accountsLoading ? (
              <div className="py-10 flex items-center justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {platforms
                  .filter((platform) => (filteredAccountsByPlatform[platform.id] || []).length > 0)
                  .map((platform) => {
                    const items = filteredAccountsByPlatform[platform.id] || [];
                    const selectedCount = items.filter((account) => selectedAccountIds.includes(account.id)).length;
                    const allSelected = selectedCount > 0 && selectedCount === items.length;
                    return (
                      <div key={platform.id} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                        <button type="button" onClick={() => togglePlatform(platform.id)} className="w-full flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.76rem" }}>
                            {getPlatformIcon(platform.id, 16)}
                            <span>{platform.name}</span>
                          </div>
                          <span className="text-slate-400" style={{ fontSize: "0.68rem" }}>
                            {selectedCount}/{items.length} {allSelected ? "✓" : ""}
                          </span>
                        </button>

                        <div className="mt-2 space-y-1.5">
                          {items.map((account) => (
                            <label
                              key={account.id}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${account.isActive ? "text-slate-700" : "text-slate-400"}`}
                              style={{ background: "rgba(148,163,184,0.1)", fontSize: "0.7rem" }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedAccountIds.includes(account.id)}
                                onChange={() => toggleAccount(account.id)}
                              />
                              <span className="truncate">{getAccountDisplayName(account)}</span>
                              {!account.isActive ? <span>({t("inactive", "inactive")})</span> : null}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                {Object.keys(filteredAccountsByPlatform).length === 0 ? (
                  <div className="py-6 text-center text-slate-400" style={{ fontSize: "0.75rem" }}>
                    {t("No accounts match your search.", "No accounts match your search.")}
                  </div>
                ) : null}
              </div>
            )}
          </motion.section>

          <motion.section
            className="rounded-2xl bg-white p-5 sm:p-6"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                {t("Per-Platform Customization", "Per-Platform Customization")}
              </h3>
              <label className="inline-flex items-center gap-2 text-slate-500" style={{ fontSize: "0.72rem" }}>
                <input
                  type="checkbox"
                  checked={overridesEnabled}
                  onChange={(event) => setOverridesEnabled(event.target.checked)}
                />
                <span>{t("Enable", "Enable")}</span>
              </label>
            </div>

            {!overridesEnabled || selectedPlatforms.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-slate-400" style={{ fontSize: "0.75rem" }}>
                {t("Select accounts first to unlock platform customizations.", "Select accounts first to unlock platform customizations.")}
              </div>
            ) : (
              <div className="space-y-3">
                {selectedPlatforms.map((platformId) => {
                  const override = platformOverrides[platformId] || {};
                  const settings = platformSettings[platformId] || {};
                  const hashtagsInput = (settings.defaultHashtags || []).join(" ");

                  return (
                    <div key={platformId} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.76rem" }}>
                          {getPlatformIcon(platformId, 16)}
                          <span>{platforms.find((item) => item.id === platformId)?.name || platformId}</span>
                        </div>

                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => clearOverride(platformId)}
                            className="text-slate-400 hover:text-red-500"
                            style={{ fontSize: "0.68rem" }}
                          >
                            {t("Clear copy", "Clear copy")}
                          </button>
                          <button
                            type="button"
                            onClick={() => clearPlatformSettings(platformId)}
                            className="text-slate-400 hover:text-red-500"
                            style={{ fontSize: "0.68rem" }}
                          >
                            {t("Clear settings", "Clear settings")}
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={override.message || ""}
                        onChange={(event) => updateOverride(platformId, { message: event.target.value })}
                        placeholder={t("Custom message for this platform", "Custom message for this platform")}
                        className="w-full py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                        style={{ fontSize: "0.75rem" }}
                      />

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={hashtagsInput}
                          onChange={(event) =>
                            updatePlatformSettings(platformId, {
                              defaultHashtags: hashtagsFromInput(event.target.value),
                            })
                          }
                          placeholder={t("Default hashtags (space/comma separated)", "Default hashtags (space/comma separated)")}
                          className="py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                          style={{ fontSize: "0.72rem" }}
                        />

                        <input
                          value={settings.notes || ""}
                          onChange={(event) => updatePlatformSettings(platformId, { notes: event.target.value || undefined })}
                          placeholder={t("Platform note for template", "Platform note for template")}
                          className="py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                          style={{ fontSize: "0.72rem" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>

          <motion.section
            className="rounded-2xl bg-white p-5 sm:p-6"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                {t("Live Preview Studio", "Live Preview Studio")}
              </h3>
              <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                {selectedPlatforms.length} {t("platforms", "platforms")}
              </span>
            </div>

            {selectedPlatforms.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-slate-400" style={{ fontSize: "0.75rem" }}>
                {t("Select target accounts to generate per-platform previews.", "Select target accounts to generate per-platform previews.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedPlatforms.map((platformId) => {
                  const platform = platforms.find((item) => item.id === platformId);
                  const previewText = getComposedMessage(platformId) || t("No text yet", "No text yet");
                  const count = selectedAccounts.filter((account) => account.platformId === platformId).length;
                  return (
                    <motion.div
                      key={platformId}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        border: "1px solid rgba(0,0,0,0.08)",
                        boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
                        background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(249,250,255,0.96))",
                      }}
                      whileHover={{ y: -2 }}
                    >
                      <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: platform?.bgGlow || "rgba(0,0,0,0.05)" }}>
                        <div className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.74rem" }}>
                          {getPlatformIcon(platformId, 16)}
                          <span>{platform?.name || platformId}</span>
                        </div>
                        <span className="text-slate-500" style={{ fontSize: "0.68rem" }}>
                          {count} {t("accounts", "accounts")}
                        </span>
                      </div>

                      <div className="p-3">
                        <p className="text-slate-700 whitespace-pre-wrap" style={{ fontSize: "0.78rem", lineHeight: 1.45 }}>
                          {previewText}
                        </p>

                        {media ? (
                          <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                            {media.kind === "image" ? (
                              <img src={media.localPreviewUrl || media.url} alt="media-preview" className="w-full h-40 object-cover" />
                            ) : (
                              <video src={media.localPreviewUrl || media.url} className="w-full h-40 object-cover bg-slate-900" muted />
                            )}
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <TemplateLibrarySection
            t={t}
            templates={templates}
            templatesLoading={templatesLoading}
            selectedTemplateId={selectedTemplateId}
            templateName={templateName}
            templateDescription={templateDescription}
            templateIsDefault={templateIsDefault}
            templateSaving={templateSaving}
            editingTemplateId={editingTemplateId}
            templateBusyId={templateBusyId}
            onTemplateSelect={(value) => {
              const id = trim(value);
              setSelectedTemplateId(id);
              const target = templates.find((item) => item.id === id);
              if (target) applyTemplate(target);
            }}
            onTemplateNameChange={setTemplateName}
            onTemplateDescriptionChange={setTemplateDescription}
            onTemplateDefaultChange={setTemplateIsDefault}
            onSaveTemplate={() => void saveTemplate()}
            onCancelEdit={() => hydrateTemplateEditor()}
            onEditTemplate={(template) => {
              hydrateTemplateEditor(template);
              applyTemplate(template);
            }}
            onSetTemplateDefault={(templateId) => void setTemplateAsDefault(templateId)}
            onDeleteTemplate={(templateId) => void deleteTemplate(templateId)}
            onApplyTemplate={(template) => applyTemplate(template)}
          />

          <AdaptationEngineSection
            t={t}
            localValidationTouched={localValidationTouched}
            localAdaptationEntries={localAdaptationEntries}
            localAdaptationSummary={localAdaptationSummary}
            lastValidation={lastValidation}
            onReset={resetComposer}
            onOpenComposer={() => {
              setComposerOpen(true);
              setLocalValidationTouched(true);
              toast.message(t("Composer focused.", "Composer focused."));
            }}
          />
        </div>
      </div>

      {lastResponse ? <ExecutionResultsSection t={t} language={language} lastResponse={lastResponse} /> : null}
    </div>
  );
}
