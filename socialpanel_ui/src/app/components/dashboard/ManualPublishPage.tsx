import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  PencilLine,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { apiRequest, getMobileAccessToken } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
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
import { ExecutionResultsSection } from "./manual-publish/ExecutionResultsSection";
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

type ManualScreen = "home" | "template" | "publish";
type PublishStep = 1 | 2 | 3 | 4;
type TargetSource = "manual" | "template";

type AccountSelectorProps = {
  t: (ar: string, en: string) => string;
  accountsLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filteredGroups: Partial<Record<PlatformType, AccountOption[]>>;
  selectedAccountIds: string[];
  onTogglePlatform: (platformId: PlatformType) => void;
  onToggleAccount: (accountId: string) => void;
};

function getAccountDisplayName(account: AccountOption): string {
  return trim(account.accountName) || trim(account.accountUsername) || account.id;
}

function AccountSelector(props: AccountSelectorProps) {
  const {
    t,
    accountsLoading,
    search,
    onSearchChange,
    filteredGroups,
    selectedAccountIds,
    onTogglePlatform,
    onToggleAccount,
  } = props;

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-5" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 18px rgba(0,0,0,0.04)" }}>
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("ابحث عن الحسابات...", "Search accounts...")}
          className="w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
          style={{ fontSize: "0.78rem" }}
        />
      </div>

      {accountsLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {platforms
            .filter((platform) => (filteredGroups[platform.id] || []).length > 0)
            .map((platform) => {
              const items = filteredGroups[platform.id] || [];
              const selectedCount = items.filter((account) => selectedAccountIds.includes(account.id)).length;
              const allSelected = selectedCount > 0 && selectedCount === items.length;
              return (
                <div key={platform.id} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                  <button
                    type="button"
                    onClick={() => onTogglePlatform(platform.id)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.75rem" }}>
                      {getPlatformIcon(platform.id, 16)}
                      <span>{platform.name}</span>
                    </div>
                    <span className="text-slate-400" style={{ fontSize: "0.67rem" }}>
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
                          onChange={() => onToggleAccount(account.id)}
                        />
                        <span className="truncate">{getAccountDisplayName(account)}</span>
                        {!account.isActive ? <span>({t("غير نشط", "inactive")})</span> : null}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

          {Object.keys(filteredGroups).length === 0 ? (
            <div className="py-6 text-center text-slate-400" style={{ fontSize: "0.75rem" }}>
              {t("لا توجد حسابات مطابقة.", "No accounts match your search.")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ManualPublishPage() {
  const { language, t } = useTheme();

  const [screen, setScreen] = useState<ManualScreen>("home");

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [templateAccountSearch, setTemplateAccountSearch] = useState("");
  const [templateTargetAccountIds, setTemplateTargetAccountIds] = useState<string[]>([]);
  const [templatePlatformSettings, setTemplatePlatformSettings] = useState<
    Partial<Record<PlatformType, ManualPlatformTemplateSettings>>
  >({});

  const [publishStep, setPublishStep] = useState<PublishStep>(1);
  const [targetSource, setTargetSource] = useState<TargetSource>("manual");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [publishAccountSearch, setPublishAccountSearch] = useState("");

  const [message, setMessage] = useState("");
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<PlatformType, ManualPlatformOverride>>>({});
  const [platformSettings, setPlatformSettings] = useState<Partial<Record<PlatformType, ManualPlatformTemplateSettings>>>({});

  const [mode, setMode] = useState<ManualPublishMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [checkConnectivity, setCheckConnectivity] = useState(true);

  const [uploadLoading, setUploadLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

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
        if (screen === "publish" && !publishLoading && !dryRunLoading) {
          void runPublish();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    if (accountsLoading || templatesLoading) return;
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;
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
    } catch {
      // ignore invalid draft
    }
  }, [accountsLoading, templatesLoading]);

  useEffect(() => {
    if (media?.localPreviewUrl) {
      return () => URL.revokeObjectURL(media.localPreviewUrl as string);
    }
    return;
  }, [media?.localPreviewUrl]);

  const publishDirty =
    trim(message).length > 0 ||
    Boolean(media) ||
    selectedAccountIds.length > 0 ||
    Object.keys(platformOverrides).length > 0 ||
    mode === "schedule";

  useEffect(() => {
    if (!publishDirty) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        message,
        media,
        selectedAccountIds,
        mode,
        scheduledAt,
        platformOverrides,
        platformSettings,
      })
    );
  }, [publishDirty, message, media, selectedAccountIds, mode, scheduledAt, platformOverrides, platformSettings]);

  const accountsByPlatform = useMemo(() => {
    const grouped: Partial<Record<PlatformType, AccountOption[]>> = {};
    for (const account of accounts) {
      if (!grouped[account.platformId]) grouped[account.platformId] = [];
      grouped[account.platformId]!.push(account);
    }
    return grouped;
  }, [accounts]);

  const filteredPublishAccounts = useMemo(() => {
    const query = trim(publishAccountSearch).toLowerCase();
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
  }, [publishAccountSearch, accountsByPlatform]);

  const filteredTemplateAccounts = useMemo(() => {
    const query = trim(templateAccountSearch).toLowerCase();
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
  }, [templateAccountSearch, accountsByPlatform]);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds]
  );

  const selectedPlatforms = useMemo(
    () => [...new Set(selectedAccounts.map((account) => account.platformId))] as PlatformType[],
    [selectedAccounts]
  );

  const templateSelectedAccounts = useMemo(
    () => accounts.filter((account) => templateTargetAccountIds.includes(account.id)),
    [accounts, templateTargetAccountIds]
  );

  const templateSelectedPlatforms = useMemo(
    () => [...new Set(templateSelectedAccounts.map((account) => account.platformId))] as PlatformType[],
    [templateSelectedAccounts]
  );

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

  function toggleAccount(accountId: string, setSelected: (value: string[] | ((prev: string[]) => string[])) => void) {
    setSelected((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  function togglePlatform(
    platformId: PlatformType,
    filteredGroups: Partial<Record<PlatformType, AccountOption[]>>,
    selected: string[],
    setSelected: (value: string[] | ((prev: string[]) => string[])) => void
  ) {
    const platformAccountIds = (filteredGroups[platformId] || []).map((item) => item.id);
    if (platformAccountIds.length === 0) return;
    const allSelected = platformAccountIds.every((id) => selected.includes(id));
    setSelected((prev) => {
      if (allSelected) return prev.filter((id) => !platformAccountIds.includes(id));
      return [...new Set([...prev, ...platformAccountIds])];
    });
  }

  function updatePublishOverride(platformId: PlatformType, patch: Partial<ManualPlatformOverride>) {
    setLocalValidationTouched(true);
    setPlatformOverrides((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  function updatePublishSettings(platformId: PlatformType, patch: Partial<ManualPlatformTemplateSettings>) {
    setLocalValidationTouched(true);
    setPlatformSettings((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  function updateTemplateSettings(platformId: PlatformType, patch: Partial<ManualPlatformTemplateSettings>) {
    setTemplatePlatformSettings((prev) => ({
      ...prev,
      [platformId]: {
        ...(prev[platformId] || {}),
        ...patch,
      },
    }));
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIsDefault(false);
    setTemplateTargetAccountIds([]);
    setTemplatePlatformSettings({});
    setTemplateAccountSearch("");
  }

  function loadTemplateIntoEditor(template: ManualTemplate) {
    setEditingTemplateId(template.id);
    setTemplateName(template.name || "");
    setTemplateDescription(template.description || "");
    setTemplateIsDefault(Boolean(template.isDefault));
    setTemplateTargetAccountIds(Array.isArray(template.defaultAccountIds) ? template.defaultAccountIds : []);
    setTemplatePlatformSettings(template.platformSettings || {});
    setScreen("template");
  }

  function applyTemplateTargets(template: ManualTemplate, notify = true) {
    setTargetSource("template");
    setSelectedTemplateId(template.id);
    setSelectedAccountIds(Array.isArray(template.defaultAccountIds) ? template.defaultAccountIds : []);
    setPlatformSettings(template.platformSettings || {});
    setPlatformOverrides({});
    setLocalValidationTouched(true);
    if (notify) {
      toast.success(t("تم تطبيق أهداف القالب", "Template targets applied."));
    }
  }

  function getComposedMessage(platformId: PlatformType): string {
    const override = platformOverrides[platformId];
    const settings = platformSettings[platformId];
    const baseMessage = trim(override?.message) || trim(message);
    const hashtags = settings?.defaultHashtags || [];
    if (hashtags.length === 0) return baseMessage;
    return `${baseMessage}\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}`.trim();
  }

  function buildPublishPayload(dryRun: boolean) {
    const payload: Record<string, unknown> = {
      message,
      mediaUrl: media?.url || undefined,
      mediaType: media?.kind,
      accountIds: selectedAccountIds,
      mode,
      dryRun,
      checkConnectivity: dryRun ? checkConnectivity : undefined,
      platformSettings,
    };

    if (mode === "schedule") {
      const date = new Date(scheduledAt);
      payload.scheduledAt = Number.isNaN(date.getTime()) ? scheduledAt : date.toISOString();
    }

    const sanitizedOverrides: Partial<Record<PlatformType, ManualPlatformOverride>> = {};
    for (const platformId of selectedPlatforms) {
      const composed = getComposedMessage(platformId);
      const next: ManualPlatformOverride = {
        message: composed || undefined,
        mediaUrl: media?.url,
        mediaType: media?.kind,
      };
      if (next.message || next.mediaUrl || next.mediaType) {
        sanitizedOverrides[platformId] = next;
      }
    }
    if (Object.keys(sanitizedOverrides).length > 0) {
      payload.platformOverrides = sanitizedOverrides;
    }

    return payload;
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
      toast.success(t("تم رفع الميديا بنجاح", "Media uploaded successfully."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل الرفع", "Upload failed."));
    } finally {
      setUploadLoading(false);
    }
  }

  async function saveTemplate() {
    const name = trim(templateName);
    if (!name) {
      toast.error(t("اسم القالب مطلوب", "Template name is required."));
      return;
    }
    if (templateTargetAccountIds.length === 0) {
      toast.error(t("اختر حسابات مستهدفة للقالب", "Select target accounts for this template."));
      return;
    }

    const payload = {
      name,
      description: trim(templateDescription) || undefined,
      isDefault: templateIsDefault,
      message: "",
      mediaUrl: undefined,
      mediaType: undefined,
      defaultAccountIds: templateTargetAccountIds,
      platformOverrides: {},
      platformSettings: templatePlatformSettings,
    };

    try {
      setTemplateSaving(true);
      if (editingTemplateId) {
        const response = await apiRequest<any>(`/api/publish-templates/${encodeURIComponent(editingTemplateId)}`, {
          method: "PATCH",
          body: payload,
        });
        const updated = response.template as ManualTemplate;
        setTemplates((prev) => {
          const next = prev.filter((item) => item.id !== updated.id);
          next.unshift(updated);
          return next;
        });
        toast.success(t("تم تحديث القالب", "Template updated."));
      } else {
        const response = await apiRequest<any>("/api/publish-templates", {
          method: "POST",
          body: payload,
        });
        const created = response.template as ManualTemplate;
        setTemplates((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
        toast.success(t("تم إنشاء القالب", "Template created."));
      }
      resetTemplateForm();
      setScreen("home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل حفظ القالب", "Failed to save template."));
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
      setTemplates((prev) => prev.map((item) => ({ ...item, isDefault: item.id === updated.id })));
      toast.success(t("تم تعيين القالب الافتراضي", "Default template updated."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل تعيين الافتراضي", "Failed to set default template."));
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
      setTemplates((prev) => prev.filter((item) => item.id !== templateId));
      if (editingTemplateId === templateId) resetTemplateForm();
      if (selectedTemplateId === templateId) setSelectedTemplateId("");
      toast.success(t("تم حذف القالب", "Template deleted."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل حذف القالب", "Failed to delete template."));
    } finally {
      setTemplateBusyId(null);
    }
  }

  async function runDryRun() {
    setLocalValidationTouched(true);
    const canSend = selectedAccountIds.length > 0 && (trim(message).length > 0 || Boolean(media));
    if (!canSend) {
      toast.error(t("أضف نص/ميديا واختر حسابات", "Select accounts and add text or media."));
      return;
    }

    try {
      setDryRunLoading(true);
      const response = await manualPublishRequest(buildPublishPayload(true));
      setLastValidation(Array.isArray(response.validation) ? response.validation : []);
      setLastResponse(response);
      const hasErrors = (response.validation || []).some((entry) =>
        entry.issues.some((issue) => issue.level === "error")
      );
      if (hasErrors) {
        toast.error(t("الفحص كشف أخطاء مانعة", "Cross-platform check found blocking issues."));
      } else {
        toast.success(t("الفحص ناجح", "Cross-platform check passed."));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل الفحص", "Dry run failed."));
    } finally {
      setDryRunLoading(false);
    }
  }

  async function runPublish() {
    setLocalValidationTouched(true);
    const canSend = selectedAccountIds.length > 0 && (trim(message).length > 0 || Boolean(media));
    if (!canSend) {
      toast.error(t("أضف نص/ميديا واختر حسابات", "Select accounts and add text or media."));
      return;
    }
    if (mode === "schedule" && !trim(scheduledAt)) {
      toast.error(t("حدد وقت جدولة صحيح", "Select a valid schedule time."));
      return;
    }
    if (localAdaptationSummary.errorCount > 0) {
      toast.error(t("قم بإصلاح أخطاء التكييف أولاً", "Fix adaptation errors before publishing."));
      return;
    }

    try {
      setPublishLoading(true);
      const response = await manualPublishRequest(buildPublishPayload(false));
      setLastValidation(Array.isArray(response.validation) ? response.validation : []);
      setLastResponse(response);

      if (response.success) {
        toast.success(t(`تم النشر إلى ${response.succeededCount || 0} حساب`, `Published to ${response.succeededCount || 0} account(s).`));
        return;
      }
      if (response.partialSuccess) {
        toast.warning(
          t(
            `نجاح جزئي: ${response.succeededCount || 0} نجح، ${response.failedCount || 0} فشل`,
            `Partial success: ${response.succeededCount || 0} succeeded, ${response.failedCount || 0} failed.`
          )
        );
        return;
      }
      toast.error(response.error || t("فشل النشر", "Publish failed."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل النشر", "Publish failed."));
    } finally {
      setPublishLoading(false);
    }
  }

  function resetPublishComposer() {
    setMessage("");
    setMedia(null);
    setSelectedTemplateId("");
    setTargetSource("manual");
    setSelectedAccountIds([]);
    setPlatformOverrides({});
    setPlatformSettings({});
    setMode("now");
    setScheduledAt("");
    setPublishStep(1);
    setLastValidation([]);
    setLastResponse(null);
    setLocalValidationTouched(false);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  const scheduleQuickActions = [
    { label: t("+1h", "+1h"), value: 1 },
    { label: t("+3h", "+3h"), value: 3 },
    { label: t("Tomorrow", "Tomorrow"), value: 24 },
  ];

  const stepMeta: Array<{ id: PublishStep; title: string }> = [
    { id: 1, title: t("الرسالة والميديا", "Message & Media") },
    { id: 2, title: t("الحسابات أو القالب", "Targets or Template") },
    { id: 3, title: t("التخصيص والمعاينة", "Customize & Preview") },
    { id: 4, title: t("المراجعة والنشر", "Review & Publish") },
  ];

  const canProceedFromStep1 = trim(message).length > 0 || Boolean(media);
  const canProceedFromStep2 = selectedAccountIds.length > 0;

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <motion.section
        className="rounded-2xl p-5 sm:p-6"
        style={{
          border: "1px solid rgba(99,102,241,0.15)",
          background: "linear-gradient(140deg, rgba(255,255,255,0.96), rgba(244,247,255,0.98), rgba(241,249,255,0.98))",
          boxShadow: "0 14px 40px rgba(79,70,229,0.08)",
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
            <h2 className="text-slate-800" style={{ fontSize: "1.15rem", fontFamily: "Cairo, sans-serif" }}>
              {t("النشر اليدوي", "Manual Publishing")}
            </h2>
            <p className="text-slate-500 mt-1" style={{ fontSize: "0.82rem" }}>
              {t(
                "واجهة مراحل منظمة: إدارة قوالب الأهداف أولاً، ثم نشر رسالة بخطوات واضحة.",
                "A staged flow: manage target templates first, then publish a message with clear steps."
              )}
            </p>
          </div>

          {screen !== "home" ? (
            <button
              type="button"
              onClick={() => setScreen("home")}
              className="px-3.5 py-2 rounded-xl bg-white text-slate-700 inline-flex items-center gap-2"
              style={{ border: "1px solid rgba(0,0,0,0.1)", fontSize: "0.76rem" }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("العودة للرئيسية", "Back to Home")}</span>
            </button>
          ) : null}
        </div>
      </motion.section>

      {screen === "home" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-5">
            <motion.section
              className="rounded-2xl bg-white p-5 sm:p-6"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetTemplateForm();
                    setScreen("template");
                  }}
                  className="text-left rounded-2xl p-4 bg-slate-50/80 hover:bg-slate-50 transition-colors"
                  style={{ border: "1px solid rgba(15,23,42,0.08)" }}
                >
                  <div className="inline-flex items-center gap-2 mb-2 text-slate-800">
                    <LayoutTemplate className="w-4.5 h-4.5" />
                    <span style={{ fontSize: "0.86rem" }}>{t("إضافة قالب", "Add Template")}</span>
                  </div>
                  <p className="text-slate-500" style={{ fontSize: "0.74rem" }}>
                    {t("حفظ أهداف النشر لكل منصة: الحسابات + إعدادات المنصة فقط.", "Save publish targets per platform: accounts + platform settings only.")}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScreen("publish");
                    setPublishStep(1);
                  }}
                  className="text-left rounded-2xl p-4 bg-indigo-50/70 hover:bg-indigo-50 transition-colors"
                  style={{ border: "1px solid rgba(79,70,229,0.18)" }}
                >
                  <div className="inline-flex items-center gap-2 mb-2 text-indigo-800">
                    <MessageSquare className="w-4.5 h-4.5" />
                    <span style={{ fontSize: "0.86rem" }}>{t("نشر رسالة", "Publish Message")}</span>
                  </div>
                  <p className="text-indigo-700" style={{ fontSize: "0.74rem" }}>
                    {t("اكتب الرسالة وارفع الميديا ثم أكمل خطوات النشر والجدولة.", "Write your message, upload media, then complete target/schedule steps.")}
                  </p>
                </button>
              </div>
            </motion.section>

            <motion.section
              className="rounded-2xl bg-white p-5 sm:p-6"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-800 inline-flex items-center gap-2" style={{ fontSize: "0.95rem" }}>
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  {t("القوالب المضافة", "Saved Templates")}
                </h3>
                <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                  {templates.length}
                </span>
              </div>

              {templatesLoading ? (
                <div className="py-8 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-slate-400" style={{ fontSize: "0.75rem" }}>
                  {t("لا توجد قوالب بعد. ابدأ بإضافة قالب أهداف.", "No templates yet. Start by adding a target template.")}
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => {
                    const targetCount = Array.isArray(template.defaultAccountIds) ? template.defaultAccountIds.length : 0;
                    return (
                      <div key={template.id} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2">
                              <p className="text-slate-700 truncate" style={{ fontSize: "0.76rem" }}>
                                {template.isDefault ? "★ " : ""}
                                {template.name}
                              </p>
                              <span className="px-2 py-0.5 rounded-full bg-white text-slate-500" style={{ fontSize: "0.64rem", border: "1px solid rgba(0,0,0,0.06)" }}>
                                {targetCount} {t("targets", "targets")}
                              </span>
                            </div>
                            {template.description ? (
                              <p className="text-slate-400 truncate mt-0.5" style={{ fontSize: "0.67rem" }}>
                                {template.description}
                              </p>
                            ) : null}
                          </div>

                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => loadTemplateIntoEditor(template)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Edit"
                            >
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void setTemplateAsDefault(template.id)}
                              disabled={templateBusyId === template.id}
                              className="text-slate-400 hover:text-amber-500 disabled:opacity-50"
                              title="Default"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteTemplate(template.id)}
                              disabled={templateBusyId === template.id}
                              className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                              title="Delete"
                            >
                              {templateBusyId === template.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              applyTemplateTargets(template);
                              setScreen("publish");
                              setPublishStep(2);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white text-slate-700"
                            style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.68rem" }}
                          >
                            {t("استخدام في النشر", "Use in Publish")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          </div>

          <div className="xl:col-span-4 space-y-5">
            <motion.section
              className="rounded-2xl bg-white p-5"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h4 className="text-slate-800 mb-2" style={{ fontSize: "0.84rem" }}>
                {t("تحسينات الواجهة المطبقة", "Implemented UX Improvements")}
              </h4>
              <ul className="space-y-1.5 text-slate-500" style={{ fontSize: "0.72rem" }}>
                <li>{t("1) البداية بأكشن واضح بدل إظهار كل الحقول", "1) Action-first landing instead of full-form overload")}</li>
                <li>{t("2) فصل مسار القوالب عن مسار النشر", "2) Templates flow separated from publish flow")}</li>
                <li>{t("3) تصميم مراحل مثل لوحة إنشاء المهام", "3) Task-creation style staged flow")}</li>
                <li>{t("4) زر استخدام القالب مباشرة في النشر", "4) One-click template-to-publish handoff")}</li>
                <li>{t("5) تحسينات حركة وانتقالات بين المراحل", "5) Improved transitions and motion")}</li>
              </ul>
            </motion.section>
          </div>
        </div>
      ) : null}

      {screen === "template" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-5">
            <motion.section
              className="rounded-2xl bg-white p-5 sm:p-6"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                  {editingTemplateId ? t("تعديل قالب", "Edit Template") : t("إضافة قالب", "Add Template")}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    resetTemplateForm();
                    setScreen("home");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600"
                  style={{ fontSize: "0.7rem" }}
                >
                  {t("إلغاء", "Cancel")}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={t("اسم القالب", "Template name")}
                  className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                  style={{ fontSize: "0.75rem" }}
                />
                <input
                  value={templateDescription}
                  onChange={(event) => setTemplateDescription(event.target.value)}
                  placeholder={t("وصف (اختياري)", "Description (optional)")}
                  className="py-2.5 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700"
                  style={{ fontSize: "0.75rem" }}
                />
              </div>

              <label className="inline-flex items-center gap-2 text-slate-600" style={{ fontSize: "0.72rem" }}>
                <input
                  type="checkbox"
                  checked={templateIsDefault}
                  onChange={(event) => setTemplateIsDefault(event.target.checked)}
                />
                <span>{t("تعيين كافتراضي", "Set as default")}</span>
              </label>
            </motion.section>

            <motion.section
              className="rounded-2xl bg-white p-5 sm:p-6"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-800" style={{ fontSize: "0.92rem" }}>
                  {t("أهداف القالب (الحسابات المستهدفة)", "Template Targets (Accounts)")}
                </h3>
                <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                  {templateTargetAccountIds.length} {t("محدد", "selected")}
                </span>
              </div>

              <AccountSelector
                t={t}
                accountsLoading={accountsLoading}
                search={templateAccountSearch}
                onSearchChange={setTemplateAccountSearch}
                filteredGroups={filteredTemplateAccounts}
                selectedAccountIds={templateTargetAccountIds}
                onTogglePlatform={(platformId) =>
                  togglePlatform(platformId, filteredTemplateAccounts, templateTargetAccountIds, setTemplateTargetAccountIds)
                }
                onToggleAccount={(accountId) => toggleAccount(accountId, setTemplateTargetAccountIds)}
              />
            </motion.section>

            <motion.section
              className="rounded-2xl bg-white p-5 sm:p-6"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h3 className="text-slate-800 mb-3" style={{ fontSize: "0.92rem" }}>
                {t("تخصيص المنصات داخل القالب", "Per-Platform Template Settings")}
              </h3>

              {templateSelectedPlatforms.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-4 text-slate-400" style={{ fontSize: "0.75rem" }}>
                  {t("اختر حسابات مستهدفة لعرض إعدادات المنصات.", "Select target accounts first to configure platform settings.")}
                </div>
              ) : (
                <div className="space-y-3">
                  {templateSelectedPlatforms.map((platformId) => {
                    const settings = templatePlatformSettings[platformId] || {};
                    return (
                      <div key={platformId} className="rounded-xl bg-slate-50/80 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div className="inline-flex items-center gap-2 text-slate-700 mb-2" style={{ fontSize: "0.76rem" }}>
                          {getPlatformIcon(platformId, 16)}
                          <span>{platforms.find((item) => item.id === platformId)?.name || platformId}</span>
                        </div>

                        <label className="inline-flex items-center gap-2 text-slate-600 mb-2" style={{ fontSize: "0.7rem" }}>
                          <input
                            type="checkbox"
                            checked={settings.enabled !== false}
                            onChange={(event) => updateTemplateSettings(platformId, { enabled: event.target.checked })}
                          />
                          <span>{t("مفعل لهذه المنصة", "Enabled for this platform")}</span>
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            value={(settings.defaultHashtags || []).join(" ")}
                            onChange={(event) =>
                              updateTemplateSettings(platformId, {
                                defaultHashtags: hashtagsFromInput(event.target.value),
                              })
                            }
                            placeholder={t("هاشتاغات افتراضية", "Default hashtags")}
                            className="py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                            style={{ fontSize: "0.72rem" }}
                          />
                          <input
                            value={settings.notes || ""}
                            onChange={(event) => updateTemplateSettings(platformId, { notes: event.target.value || undefined })}
                            placeholder={t("ملاحظات", "Notes")}
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

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                type="button"
                onClick={() => void saveTemplate()}
                disabled={templateSaving}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ fontSize: "0.82rem" }}
              >
                {templateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{editingTemplateId ? t("تحديث القالب", "Update Template") : t("حفظ القالب", "Save Template")}</span>
              </button>
            </motion.div>
          </div>

          <div className="xl:col-span-4">
            <motion.section
              className="rounded-2xl bg-white p-5"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h4 className="text-slate-800 mb-2" style={{ fontSize: "0.82rem" }}>
                {t("منطق القالب الآن", "Template Logic Now")}
              </h4>
              <ul className="space-y-1.5 text-slate-500" style={{ fontSize: "0.72rem" }}>
                <li>{t("القالب يحفظ الـ Targets فقط", "Template stores targets only")}</li>
                <li>{t("يدعم تخصيص إعدادات لكل منصة", "Supports per-platform settings")}</li>
                <li>{t("لا يحفظ نص الرسالة أو الميديا", "Does not store post message/media")}</li>
              </ul>
            </motion.section>
          </div>
        </div>
      ) : null}

      {screen === "publish" ? (
        <div className="space-y-5">
          <motion.section
            className="rounded-2xl bg-white p-4 sm:p-5"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {stepMeta.map((step, index) => {
                const active = step.id === publishStep;
                const done = step.id < publishStep;
                return (
                  <div key={step.id} className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPublishStep(step.id)}
                      className={`px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 ${
                        active ? "bg-slate-900 text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                      style={{ fontSize: "0.69rem" }}
                    >
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{step.id}</span>}
                      <span>{step.title}</span>
                    </button>
                    {index < stepMeta.length - 1 ? <ChevronRight className="w-3.5 h-3.5 text-slate-300" /> : null}
                  </div>
                );
              })}
            </div>
          </motion.section>

          <AnimatePresence mode="wait" initial={false}>
            {publishStep === 1 ? (
              <motion.section
                key="publish-step-1"
                className="rounded-2xl bg-white p-5 sm:p-6"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                    {t("الخطوة 1: اكتب الرسالة وارفع الميديا", "Step 1: Compose message and upload media")}
                  </h3>
                  <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                    {message.length} {t("حرف", "chars")}
                  </span>
                </div>

                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setLocalValidationTouched(true);
                  }}
                  rows={7}
                  placeholder={t("اكتب نص الرسالة هنا...", "Write your post message here...")}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
                  style={{ fontSize: "0.9rem", minHeight: 170 }}
                />

                <div
                  className="mt-4 rounded-2xl p-4 bg-slate-50/80"
                  style={{ border: "1px dashed rgba(99,102,241,0.35)" }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) void uploadMedia(file);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-700" style={{ fontSize: "0.82rem" }}>
                        {t("الميديا", "Media")}
                      </p>
                      <p className="text-slate-400 mt-1" style={{ fontSize: "0.72rem" }}>
                        {t("رفع تلقائي للصور/الفيديو فقط", "Auto upload for image/video only")}
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
                      <span>{t("رفع", "Upload")}</span>
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
                            <img src={media.localPreviewUrl || media.url} alt="uploaded-media" className="w-14 h-14 rounded-lg object-cover" />
                          ) : (
                            <video src={media.localPreviewUrl || media.url} className="w-14 h-14 rounded-lg object-cover bg-slate-900" muted />
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
              </motion.section>
            ) : null}

            {publishStep === 2 ? (
              <motion.section
                key="publish-step-2"
                className="rounded-2xl bg-white p-5 sm:p-6"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <h3 className="text-slate-800 mb-3" style={{ fontSize: "0.95rem" }}>
                  {t("الخطوة 2: اختر الحسابات يدويًا أو طبق قالب", "Step 2: Select accounts manually or apply a template")}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetSource("manual");
                      setSelectedTemplateId("");
                    }}
                    className={`px-3 py-2.5 rounded-xl ${targetSource === "manual" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                    style={{ fontSize: "0.74rem" }}
                  >
                    {t("اختيار يدوي للحسابات", "Manual account selection")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetSource("template")}
                    className={`px-3 py-2.5 rounded-xl ${targetSource === "template" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                    style={{ fontSize: "0.74rem" }}
                  >
                    {t("اختيار قالب", "Use template")}
                  </button>
                </div>

                {targetSource === "template" ? (
                  <div className="space-y-3">
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => {
                        const id = trim(event.target.value);
                        setSelectedTemplateId(id);
                        const target = templates.find((item) => item.id === id);
                        if (target) applyTemplateTargets(target);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700"
                      style={{ fontSize: "0.75rem" }}
                    >
                      <option value="">{t("اختر قالب...", "Choose a template...")}</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.isDefault ? "★ " : ""}
                          {template.name}
                        </option>
                      ))}
                    </select>

                    <div className="rounded-xl bg-slate-50 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)", fontSize: "0.73rem" }}>
                      {selectedTemplateId
                        ? t(
                            `تم تطبيق أهداف القالب: ${selectedAccountIds.length} حساب`,
                            `Template targets applied: ${selectedAccountIds.length} account(s)`
                          )
                        : t("اختر قالبًا لتطبيق الأهداف.", "Choose a template to apply targets.")}
                    </div>
                  </div>
                ) : (
                  <AccountSelector
                    t={t}
                    accountsLoading={accountsLoading}
                    search={publishAccountSearch}
                    onSearchChange={setPublishAccountSearch}
                    filteredGroups={filteredPublishAccounts}
                    selectedAccountIds={selectedAccountIds}
                    onTogglePlatform={(platformId) =>
                      togglePlatform(platformId, filteredPublishAccounts, selectedAccountIds, setSelectedAccountIds)
                    }
                    onToggleAccount={(accountId) => toggleAccount(accountId, setSelectedAccountIds)}
                  />
                )}
              </motion.section>
            ) : null}

            {publishStep === 3 ? (
              <motion.section
                key="publish-step-3"
                className="rounded-2xl bg-white p-5 sm:p-6"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-slate-800" style={{ fontSize: "0.95rem" }}>
                    {t("الخطوة 3: التخصيص والمعاينة", "Step 3: Customization + Preview")}
                  </h3>
                  <span className="text-slate-400" style={{ fontSize: "0.72rem" }}>
                    {selectedPlatforms.length} {t("منصات", "platforms")}
                  </span>
                </div>

                {selectedPlatforms.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-4 text-slate-400" style={{ fontSize: "0.75rem" }}>
                    {t("اختر حسابات مستهدفة أولاً.", "Select target accounts first.")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {selectedPlatforms.map((platformId) => {
                      const settings = platformSettings[platformId] || {};
                      const override = platformOverrides[platformId] || {};
                      const composed = getComposedMessage(platformId) || t("لا يوجد نص بعد", "No text yet");
                      const hashtagsInput = (settings.defaultHashtags || []).join(" ");
                      const accountCount = selectedAccounts.filter((acc) => acc.platformId === platformId).length;
                      const editable = targetSource === "manual";
                      return (
                        <motion.div
                          key={platformId}
                          className="rounded-2xl overflow-hidden"
                          style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 20px rgba(15,23,42,0.05)", background: "linear-gradient(180deg, rgba(255,255,255,1), rgba(249,250,255,0.96))" }}
                          whileHover={{ y: -2 }}
                        >
                          <div className="px-3 py-2.5 flex items-center justify-between" style={{ background: platforms.find((item) => item.id === platformId)?.bgGlow || "rgba(0,0,0,0.05)" }}>
                            <div className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.74rem" }}>
                              {getPlatformIcon(platformId, 16)}
                              <span>{platforms.find((item) => item.id === platformId)?.name || platformId}</span>
                            </div>
                            <span className="text-slate-500" style={{ fontSize: "0.68rem" }}>
                              {accountCount} {t("حساب", "accounts")}
                            </span>
                          </div>

                          <div className="p-3 space-y-2.5">
                            {editable ? (
                              <>
                                <textarea
                                  rows={3}
                                  value={override.message || ""}
                                  onChange={(event) => updatePublishOverride(platformId, { message: event.target.value })}
                                  placeholder={t("نص مخصص لهذه المنصة", "Custom message for this platform")}
                                  className="w-full py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                                  style={{ fontSize: "0.74rem" }}
                                />

                                <div className="grid grid-cols-1 gap-2">
                                  <input
                                    value={hashtagsInput}
                                    onChange={(event) =>
                                      updatePublishSettings(platformId, { defaultHashtags: hashtagsFromInput(event.target.value) })
                                    }
                                    placeholder={t("هاشتاغات (فصل بمسافة)", "Hashtags (space separated)")}
                                    className="py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700"
                                    style={{ fontSize: "0.71rem" }}
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="rounded-lg bg-indigo-50 text-indigo-700 px-3 py-2" style={{ fontSize: "0.69rem" }}>
                                {t("تم تطبيق إعدادات القالب لهذه المنصة.", "Template settings are applied for this platform.")}
                              </div>
                            )}

                            <div className="rounded-xl bg-white p-3" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                              <p className="text-slate-700 whitespace-pre-wrap" style={{ fontSize: "0.76rem", lineHeight: 1.45 }}>
                                {composed}
                              </p>
                              {media ? (
                                <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                                  {media.kind === "image" ? (
                                    <img src={media.localPreviewUrl || media.url} alt="preview" className="w-full h-36 object-cover" />
                                  ) : (
                                    <video src={media.localPreviewUrl || media.url} className="w-full h-36 object-cover bg-slate-900" muted />
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            ) : null}

            {publishStep === 4 ? (
              <motion.section
                key="publish-step-4"
                className="rounded-2xl bg-white p-5 sm:p-6"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <h3 className="text-slate-800 mb-3" style={{ fontSize: "0.95rem" }}>
                  {t("الخطوة 4: المراجعة والنشر", "Step 4: Review and Publish")}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-2xl p-4 bg-slate-50/80" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-slate-700 mb-2" style={{ fontSize: "0.82rem" }}>
                      {t("وقت النشر", "Publishing Time")}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setMode("now")}
                        className={`px-3 py-2.5 rounded-xl ${mode === "now" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
                        style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.74rem" }}
                      >
                        {t("الآن", "Now")}
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
                        {t("جدولة", "Schedule")}
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
                  </div>

                  <div className="rounded-2xl p-4 bg-slate-50/80" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p className="text-slate-700 mb-2" style={{ fontSize: "0.82rem" }}>
                      {t("نتيجة التكييف", "Adaptation Summary")}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-full ${localAdaptationSummary.errorCount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} style={{ fontSize: "0.67rem" }}>
                        {localAdaptationSummary.errorCount} {t("أخطاء", "errors")}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700" style={{ fontSize: "0.67rem" }}>
                        {localAdaptationSummary.warningCount} {t("تحذيرات", "warnings")}
                      </span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-slate-500" style={{ fontSize: "0.72rem" }}>
                      <input
                        type="checkbox"
                        checked={checkConnectivity}
                        onChange={(event) => setCheckConnectivity(event.target.checked)}
                      />
                      <span>{t("فحص اتصال الحسابات أثناء Dry-Run", "Check account connectivity during dry-run")}</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void runDryRun()}
                    disabled={dryRunLoading || publishLoading}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center gap-2 disabled:opacity-50"
                    style={{ fontSize: "0.78rem" }}
                  >
                    {dryRunLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    <span>{t("تشغيل الفحص", "Run Validation")}</span>
                  </button>

                  <button
                    onClick={() => void runPublish()}
                    disabled={publishLoading || dryRunLoading}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-900 text-white inline-flex items-center gap-2 disabled:opacity-50"
                    style={{ fontSize: "0.78rem", boxShadow: "0 8px 24px rgba(15,23,42,0.2)" }}
                  >
                    {publishLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{mode === "schedule" ? t("جدولة", "Schedule") : t("نشر الآن", "Publish Now")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={resetPublishComposer}
                    className="px-3.5 py-2.5 rounded-xl bg-white text-slate-700"
                    style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.78rem" }}
                  >
                    {t("إعادة ضبط", "Reset")}
                  </button>
                </div>

                {lastValidation.length > 0 ? (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="inline-flex items-center gap-1.5 text-blue-600 mb-2" style={{ fontSize: "0.72rem" }}>
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>{t("لقطة تحقق الخادم", "Server validation snapshot")}</span>
                    </div>
                    <div className="space-y-1 max-h-[180px] overflow-y-auto">
                      {lastValidation.map((entry) => (
                        <div key={`${entry.accountId}-${entry.platformId}`} className="rounded-lg bg-slate-50 p-2" style={{ fontSize: "0.66rem" }}>
                          <div className="inline-flex items-center gap-1.5 text-slate-700">
                            {getPlatformIcon(entry.platformId, 14)}
                            <span>{entry.accountName}</span>
                          </div>
                          {entry.issues.length > 0 ? (
                            <div className="mt-1 text-slate-500">{entry.issues[0]?.message}</div>
                          ) : (
                            <div className="mt-1 text-emerald-600">{t("بدون مشاكل", "No issues")}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </motion.section>
            ) : null}
          </AnimatePresence>

          <motion.section
            className="rounded-2xl bg-white p-4"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPublishStep((prev) => (prev > 1 ? ((prev - 1) as PublishStep) : prev))}
                disabled={publishStep === 1}
                className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
                style={{ fontSize: "0.72rem" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("السابق", "Back")}
              </button>

              <span className="text-slate-400" style={{ fontSize: "0.7rem" }}>
                {t(`الخطوة ${publishStep} من 4`, `Step ${publishStep} of 4`)}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (publishStep === 1 && !canProceedFromStep1) {
                    toast.error(t("أضف نصاً أو ميديا للمتابعة", "Add text or media to continue."));
                    return;
                  }
                  if (publishStep === 2 && !canProceedFromStep2) {
                    toast.error(t("اختر حسابات مستهدفة", "Select target accounts to continue."));
                    return;
                  }
                  if (publishStep < 4) setPublishStep((publishStep + 1) as PublishStep);
                }}
                disabled={publishStep === 4}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-40 inline-flex items-center gap-1"
                style={{ fontSize: "0.72rem" }}
              >
                {t("التالي", "Next")}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.section>
        </div>
      ) : null}

      {lastResponse ? <ExecutionResultsSection t={t} language={language} lastResponse={lastResponse} /> : null}
    </div>
  );
}
