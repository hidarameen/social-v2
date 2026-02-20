import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Play,
  Save,
  Send,
  Trash2,
  Upload,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { apiRequest, getMobileAccessToken } from "../../services/api";
import { useTheme } from "../../context/ThemeContext";

type ManualPublishMode = "now" | "schedule";
type ManualMediaType = "image" | "video" | "link";

type AccountOption = {
  id: string;
  platformId: PlatformType;
  accountName: string;
  accountUsername?: string;
  isActive: boolean;
};

type ManualValidationIssue = {
  level: "error" | "warning";
  message: string;
};

type ManualValidationEntry = {
  accountId: string;
  platformId: PlatformType;
  accountName: string;
  issues: ManualValidationIssue[];
};

type ManualResultEntry = {
  accountId: string;
  platformId: PlatformType;
  accountName: string;
  success: boolean;
  postId?: string;
  url?: string;
  scheduledFor?: string;
  error?: string;
};

type ManualPublishResponse = {
  success: boolean;
  partialSuccess?: boolean;
  dryRun?: boolean;
  error?: string;
  mode?: ManualPublishMode;
  scheduledAt?: string;
  succeededCount?: number;
  failedCount?: number;
  validation?: ManualValidationEntry[];
  results?: ManualResultEntry[];
};

type ManualTemplate = {
  id: string;
  name: string;
  description?: string;
  message: string;
  mediaUrl?: string;
  mediaType?: ManualMediaType;
  defaultAccountIds: string[];
  platformOverrides: Partial<Record<PlatformType, ManualPlatformOverride>>;
  createdAt: string;
  updatedAt: string;
};

type ManualPlatformOverride = {
  message?: string;
  mediaUrl?: string;
  mediaType?: ManualMediaType;
};

type UploadResponse = {
  success: boolean;
  url?: string;
  mimeType?: string;
  error?: string;
};

const PLATFORM_IDS = platforms.map((platform) => platform.id);

function isPlatformType(value: string): value is PlatformType {
  return (PLATFORM_IDS as string[]).includes(value);
}

function trim(value: unknown): string {
  return String(value || "").trim();
}

function getAccountDisplayName(account: AccountOption): string {
  return trim(account.accountName) || trim(account.accountUsername) || account.id;
}

function formatDateTime(value?: string, locale = "en"): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "ar" ? "ar" : "en-US");
}

async function manualPublishRequest(body: Record<string, unknown>): Promise<ManualPublishResponse> {
  const token = getMobileAccessToken();
  const response = await fetch("/api/manual-publish", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as ManualPublishResponse;
  if (!response.ok) {
    throw new Error(trim(payload.error) || `Request failed: ${response.status}`);
  }
  return payload;
}

export function ManualPublishPage() {
  const { language, t } = useTheme();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateBusyId, setTemplateBusyId] = useState<string | null>(null);

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<ManualMediaType>("link");
  const [mode, setMode] = useState<ManualPublishMode>("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [checkConnectivity, setCheckConnectivity] = useState(true);

  const [overridesEnabled, setOverridesEnabled] = useState(false);
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<PlatformType, ManualPlatformOverride>>>({});

  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [lastValidation, setLastValidation] = useState<ManualValidationEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<ManualPublishResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      try {
        const payload = await apiRequest<any>("/api/accounts?limit=200&offset=0&sortBy=createdAt&sortDir=desc");
        if (!active) return;
        const mapped: AccountOption[] = [];
        for (const raw of (payload.accounts || []) as any[]) {
          const platformId = String(raw.platformId || "").trim();
          if (!isPlatformType(platformId)) continue;
          const id = trim(raw.id);
          if (!id) continue;
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
        const list = Array.isArray(payload.templates) ? payload.templates : [];
        setTemplates(list as ManualTemplate[]);
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

  const selectedPlatforms = useMemo(() => {
    return [...new Set(selectedAccounts.map((account) => account.platformId))];
  }, [selectedAccounts]);

  const canSend = selectedAccountIds.length > 0 && (trim(message).length > 0 || trim(mediaUrl).length > 0);

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  }

  function togglePlatform(platformId: PlatformType) {
    const platformAccountIds = (accountsByPlatform[platformId] || []).map((item) => item.id);
    if (platformAccountIds.length === 0) return;
    const allSelected = platformAccountIds.every((id) => selectedAccountIds.includes(id));
    setSelectedAccountIds((prev) => {
      if (allSelected) return prev.filter((id) => !platformAccountIds.includes(id));
      return [...new Set([...prev, ...platformAccountIds])];
    });
  }

  function updateOverride(platformId: PlatformType, patch: Partial<ManualPlatformOverride>) {
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

  function buildPayload(extra: { dryRun: boolean }) {
    const payload: Record<string, unknown> = {
      message,
      mediaUrl: trim(mediaUrl) || undefined,
      mediaType: trim(mediaUrl) ? mediaType : undefined,
      accountIds: selectedAccountIds,
      mode,
      dryRun: extra.dryRun,
      checkConnectivity: extra.dryRun ? checkConnectivity : undefined,
    };

    if (mode === "schedule") {
      const date = new Date(scheduledAt);
      if (!Number.isNaN(date.getTime())) {
        payload.scheduledAt = date.toISOString();
      } else {
        payload.scheduledAt = scheduledAt;
      }
    }

    if (overridesEnabled) {
      const sanitized: Partial<Record<PlatformType, ManualPlatformOverride>> = {};
      for (const platformId of selectedPlatforms) {
        const item = platformOverrides[platformId];
        if (!item) continue;
        const next: ManualPlatformOverride = {
          message: trim(item.message) || undefined,
          mediaUrl: trim(item.mediaUrl) || undefined,
          mediaType: item.mediaType,
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

  async function runDryRun() {
    if (!canSend) {
      toast.error(t("اختر حسابات وأضف محتوى أو رابط وسائط", "Select accounts and add content or media."));
      return;
    }

    try {
      setDryRunLoading(true);
      const response = await manualPublishRequest(buildPayload({ dryRun: true }));
      const validation = Array.isArray(response.validation) ? response.validation : [];
      setLastValidation(validation);
      setLastResponse(response);
      const hasErrors = validation.some((entry) => entry.issues.some((issue) => issue.level === "error"));
      if (hasErrors) {
        toast.error(t("نتائج الفحص تحتوي أخطاء", "Validation completed with errors."));
      } else {
        toast.success(t("الفحص نجح بدون أخطاء", "Validation succeeded with no errors."));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("تعذر تنفيذ الفحص", "Dry run failed."));
    } finally {
      setDryRunLoading(false);
    }
  }

  async function runPublish() {
    if (!canSend) {
      toast.error(t("اختر حسابات وأضف محتوى أو رابط وسائط", "Select accounts and add content or media."));
      return;
    }
    if (mode === "schedule" && !trim(scheduledAt)) {
      toast.error(t("حدد وقت الجدولة", "Select schedule time."));
      return;
    }

    try {
      setPublishLoading(true);
      const response = await manualPublishRequest(buildPayload({ dryRun: false }));
      setLastResponse(response);
      setLastValidation(Array.isArray(response.validation) ? response.validation : []);

      if (response.success) {
        toast.success(
          t(
            `تم النشر بنجاح على ${response.succeededCount || 0} حساب`,
            `Published successfully to ${response.succeededCount || 0} accounts.`
          )
        );
        return;
      }

      if (response.partialSuccess) {
        toast.warning(
          t(
            `نجاح جزئي: ${response.succeededCount || 0} نجح و ${response.failedCount || 0} فشل`,
            `Partial success: ${response.succeededCount || 0} succeeded and ${response.failedCount || 0} failed.`
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

      setMediaUrl(payload.url);
      if (trim(payload.mimeType).startsWith("image/")) setMediaType("image");
      if (trim(payload.mimeType).startsWith("video/")) setMediaType("video");
      toast.success(t("تم رفع الملف", "Media uploaded."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("فشل رفع الملف", "Upload failed."));
    } finally {
      setUploadLoading(false);
    }
  }

  async function saveTemplate() {
    const name = trim(templateName);
    if (!name) {
      toast.error(t("أدخل اسم القالب", "Template name is required."));
      return;
    }

    try {
      setTemplateSaving(true);
      const payload = await apiRequest<any>("/api/publish-templates", {
        method: "POST",
        body: {
          name,
          description: trim(templateDescription) || undefined,
          message,
          mediaUrl: trim(mediaUrl) || undefined,
          mediaType: trim(mediaUrl) ? mediaType : undefined,
          defaultAccountIds: selectedAccountIds,
          platformOverrides: overridesEnabled ? platformOverrides : undefined,
        },
      });
      const created = payload.template as ManualTemplate;
      setTemplates((prev) => [created, ...prev]);
      setTemplateName("");
      setTemplateDescription("");
      toast.success(t("تم حفظ القالب", "Template saved."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("تعذر حفظ القالب", "Failed to save template."));
    } finally {
      setTemplateSaving(false);
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
      setTemplates((prev) => prev.filter((template) => template.id !== templateId));
      toast.success(t("تم حذف القالب", "Template deleted."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("تعذر حذف القالب", "Failed to delete template."));
    } finally {
      setTemplateBusyId(null);
    }
  }

  function applyTemplate(template: ManualTemplate) {
    setMessage(template.message || "");
    setMediaUrl(template.mediaUrl || "");
    setMediaType(template.mediaType || "link");
    setSelectedAccountIds(template.defaultAccountIds || []);
    if (template.platformOverrides && Object.keys(template.platformOverrides).length > 0) {
      setOverridesEnabled(true);
      setPlatformOverrides(template.platformOverrides || {});
    } else {
      setOverridesEnabled(false);
      setPlatformOverrides({});
    }
    toast.success(t("تم تطبيق القالب", "Template applied."));
  }

  function resetComposer() {
    setMessage("");
    setMediaUrl("");
    setMediaType("link");
    setMode("now");
    setScheduledAt("");
    setOverridesEnabled(false);
    setPlatformOverrides({});
    setLastValidation([]);
    setLastResponse(null);
  }

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <motion.div
        className="rounded-2xl bg-white dark:bg-slate-800/50 p-5 sm:p-6"
        style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 mb-2">
              <Send className="w-4 h-4 text-violet-600" />
              <span className="text-violet-700" style={{ fontSize: "0.75rem" }}>
                {t("النشر اليدوي", "Manual Publish")}
              </span>
            </div>
            <h2 className="text-slate-800 dark:text-slate-100" style={{ fontSize: "1.125rem" }}>
              {t("لوحة النشر اليدوي الكاملة", "Full Manual Publishing Workspace")}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1" style={{ fontSize: "0.8125rem" }}>
              {t(
                "اختر الحسابات، اكتب المحتوى، افحص القواعد، ثم انشر أو جدول مباشرة.",
                "Select accounts, compose content, validate, then publish or schedule directly."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runDryRun}
              disabled={dryRunLoading || publishLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center gap-2 disabled:opacity-50"
              style={{ fontSize: "0.8125rem" }}
            >
              {dryRunLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{t("فحص", "Validate")}</span>
            </button>
            <button
              onClick={runPublish}
              disabled={publishLoading || dryRunLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-white inline-flex items-center gap-2 disabled:opacity-50"
              style={{ fontSize: "0.8125rem", boxShadow: "0 4px 18px rgba(15,23,42,0.2)" }}
            >
              {publishLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{mode === "schedule" ? t("جدولة", "Schedule") : t("نشر الآن", "Publish Now")}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl bg-slate-50/80 p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                  {t("المحتوى", "Message")}
                </label>
                <span className="text-slate-400" style={{ fontSize: "0.75rem" }}>
                  {message.length} {t("حرف", "chars")}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                placeholder={t("اكتب نص المنشور...", "Write post content...")}
                className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-y"
                style={{ fontSize: "0.875rem", minHeight: 140 }}
              />
            </div>

            <div className="rounded-xl bg-slate-50/80 p-4 space-y-3" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="flex items-center justify-between gap-2">
                <label className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                  {t("رابط الوسائط", "Media URL")}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadLoading}
                    className="px-3 py-2 rounded-lg bg-white text-slate-700 inline-flex items-center gap-2 disabled:opacity-50"
                    style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.75rem" }}
                  >
                    {uploadLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{t("رفع ملف", "Upload")}</span>
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
              </div>

              <input
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
                placeholder={t("https://...", "https://...")}
                className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                style={{ fontSize: "0.8125rem" }}
              />

              <div className="grid grid-cols-3 gap-2">
                {(["link", "image", "video"] as ManualMediaType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMediaType(type)}
                    className={`px-3 py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 transition-all ${
                      mediaType === type ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                    style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.75rem" }}
                  >
                    {type === "image" ? <ImageIcon className="w-3.5 h-3.5" /> : null}
                    {type === "video" ? <Video className="w-3.5 h-3.5" /> : null}
                    {type === "link" ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50/80 p-4 space-y-3" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-slate-500" />
                <label className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                  {t("وضع النشر", "Publish Mode")}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("now")}
                  className={`px-3 py-2.5 rounded-xl transition-all ${mode === "now" ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}
                  style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.75rem" }}
                >
                  {t("الآن", "Now")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("schedule")}
                  className={`px-3 py-2.5 rounded-xl transition-all ${
                    mode === "schedule" ? "bg-slate-800 text-white" : "bg-white text-slate-600"
                  }`}
                  style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.75rem" }}
                >
                  {t("جدولة", "Schedule")}
                </button>
              </div>

              {mode === "schedule" ? (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  style={{ fontSize: "0.8125rem" }}
                />
              ) : null}

              <label className="flex items-center gap-2 text-slate-600" style={{ fontSize: "0.75rem" }}>
                <input
                  type="checkbox"
                  className="rounded"
                  checked={checkConnectivity}
                  onChange={(event) => setCheckConnectivity(event.target.checked)}
                />
                <span>{t("فحص اتصال الحسابات أثناء الفحص", "Check account connectivity during dry run")}</span>
              </label>
            </div>

            <div className="rounded-xl bg-slate-50/80 p-4 space-y-3" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <label className="flex items-center gap-2 text-slate-700" style={{ fontSize: "0.8125rem" }}>
                <input
                  type="checkbox"
                  checked={overridesEnabled}
                  onChange={(event) => setOverridesEnabled(event.target.checked)}
                />
                <span>{t("تفعيل تخصيص المنصات", "Enable platform overrides")}</span>
              </label>

              {overridesEnabled && selectedPlatforms.length > 0 ? (
                <div className="space-y-3">
                  {selectedPlatforms.map((platformId) => {
                    const override = platformOverrides[platformId] || {};
                    return (
                      <div key={platformId} className="rounded-lg bg-white p-3 space-y-2" style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(platformId, 18)}
                            <span className="text-slate-700" style={{ fontSize: "0.75rem" }}>
                              {platforms.find((item) => item.id === platformId)?.name || platformId}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => clearOverride(platformId)}
                            className="text-slate-400 hover:text-red-500"
                            style={{ fontSize: "0.6875rem" }}
                          >
                            {t("مسح", "Clear")}
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={override.message || ""}
                          onChange={(event) => updateOverride(platformId, { message: event.target.value })}
                          placeholder={t("رسالة مخصصة لهذه المنصة", "Custom message for this platform")}
                          className="w-full py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400"
                          style={{ fontSize: "0.75rem" }}
                        />
                        <input
                          value={override.mediaUrl || ""}
                          onChange={(event) => updateOverride(platformId, { mediaUrl: event.target.value })}
                          placeholder={t("رابط وسائط مخصص", "Custom media URL")}
                          className="w-full py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400"
                          style={{ fontSize: "0.75rem" }}
                        />
                        <select
                          value={override.mediaType || ""}
                          onChange={(event) =>
                            updateOverride(platformId, {
                              mediaType: trim(event.target.value) ? (event.target.value as ManualMediaType) : undefined,
                            })
                          }
                          className="w-full py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400"
                          style={{ fontSize: "0.75rem" }}
                        >
                          <option value="">{t("افتراضي", "Default")}</option>
                          <option value="link">link</option>
                          <option value="image">image</option>
                          <option value="video">video</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50/80 p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                  {t("الحسابات المستهدفة", "Target Accounts")}
                </h3>
                <span className="text-slate-400" style={{ fontSize: "0.75rem" }}>
                  {selectedAccountIds.length}
                </span>
              </div>

              {accountsLoading ? (
                <div className="py-6 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
                  {t("لا توجد حسابات متصلة", "No connected accounts.")}
                </p>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {platforms
                    .filter((platform) => (accountsByPlatform[platform.id] || []).length > 0)
                    .map((platform) => {
                      const items = accountsByPlatform[platform.id] || [];
                      const selectedCount = items.filter((account) => selectedAccountIds.includes(account.id)).length;
                      const allSelected = selectedCount > 0 && selectedCount === items.length;
                      return (
                        <div key={platform.id} className="rounded-lg bg-white p-2.5" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
                          <button
                            type="button"
                            onClick={() => togglePlatform(platform.id)}
                            className="w-full flex items-center justify-between"
                          >
                            <span className="inline-flex items-center gap-2 text-slate-700" style={{ fontSize: "0.75rem" }}>
                              {getPlatformIcon(platform.id, 16)}
                              <span>{platform.name}</span>
                            </span>
                            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                              {selectedCount}/{items.length} {allSelected ? "✓" : ""}
                            </span>
                          </button>
                          <div className="mt-2 space-y-1.5">
                            {items.map((account) => (
                              <label
                                key={account.id}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${
                                  account.isActive ? "text-slate-600" : "text-slate-400"
                                }`}
                                style={{ fontSize: "0.6875rem", background: "rgba(148,163,184,0.08)" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedAccountIds.includes(account.id)}
                                  onChange={() => toggleAccount(account.id)}
                                />
                                <span className="truncate">{getAccountDisplayName(account)}</span>
                                {!account.isActive ? <span>({t("غير نشط", "inactive")})</span> : null}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-50/80 p-4 space-y-3" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <h3 className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                {t("القوالب", "Templates")}
              </h3>

              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder={t("اسم القالب", "Template name")}
                className="w-full py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400"
                style={{ fontSize: "0.75rem" }}
              />
              <input
                value={templateDescription}
                onChange={(event) => setTemplateDescription(event.target.value)}
                placeholder={t("وصف مختصر (اختياري)", "Short description (optional)")}
                className="w-full py-2.5 px-3 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-none focus:border-violet-400"
                style={{ fontSize: "0.75rem" }}
              />
              <button
                type="button"
                onClick={saveTemplate}
                disabled={templateSaving}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ fontSize: "0.75rem" }}
              >
                {templateSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{t("حفظ كقالب", "Save as Template")}</span>
              </button>

              <div className="border-t border-slate-200 pt-3 space-y-2 max-h-[220px] overflow-y-auto">
                {templatesLoading ? (
                  <div className="py-3 text-slate-400 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>
                    {t("لا توجد قوالب محفوظة", "No saved templates.")}
                  </p>
                ) : (
                  templates.map((template) => (
                    <div key={template.id} className="rounded-lg bg-white p-2.5" style={{ border: "1px solid rgba(0,0,0,0.07)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-slate-700 truncate" style={{ fontSize: "0.75rem" }}>
                            {template.name}
                          </p>
                          {template.description ? (
                            <p className="text-slate-400 truncate" style={{ fontSize: "0.6875rem" }}>
                              {template.description}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteTemplate(template.id)}
                          disabled={templateBusyId === template.id}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                        >
                          {templateBusyId === template.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="mt-2 w-full px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                        style={{ fontSize: "0.6875rem" }}
                      >
                        {t("تطبيق", "Apply")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-500" style={{ fontSize: "0.75rem" }}>
            {t(
              `محدد ${selectedAccountIds.length} حساب | ${mode === "schedule" ? "جدولة" : "نشر فوري"}`,
              `${selectedAccountIds.length} account(s) selected | ${mode === "schedule" ? "scheduled" : "instant"}`
            )}
          </div>
          <button
            type="button"
            onClick={resetComposer}
            className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
            style={{ fontSize: "0.75rem" }}
          >
            {t("تفريغ النموذج", "Reset Form")}
          </button>
        </div>
      </motion.div>

      {lastValidation.length > 0 ? (
        <motion.div
          className="rounded-2xl bg-white dark:bg-slate-800/50 p-5 sm:p-6"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-slate-800 dark:text-slate-100 mb-3" style={{ fontSize: "0.9375rem" }}>
            {t("نتائج الفحص", "Validation Results")}
          </h3>
          <div className="space-y-2">
            {lastValidation.map((entry) => (
              <div key={`${entry.accountId}-${entry.platformId}`} className="rounded-xl bg-slate-50 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center gap-2 mb-2">
                  {getPlatformIcon(entry.platformId, 16)}
                  <span className="text-slate-700" style={{ fontSize: "0.75rem" }}>
                    {entry.accountName}
                  </span>
                </div>
                {entry.issues.length === 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-emerald-600" style={{ fontSize: "0.75rem" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("لا توجد ملاحظات", "No issues")}</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {entry.issues.map((issue, index) => (
                      <div
                        key={`${entry.accountId}-${index}`}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                          issue.level === "error" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
                        }`}
                        style={{ fontSize: "0.6875rem" }}
                      >
                        {issue.level === "error" ? <XCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ) : null}

      {lastResponse?.results && lastResponse.results.length > 0 ? (
        <motion.div
          className="rounded-2xl bg-white dark:bg-slate-800/50 p-5 sm:p-6"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-slate-800 dark:text-slate-100 mb-3" style={{ fontSize: "0.9375rem" }}>
            {t("نتائج التنفيذ", "Execution Results")}
          </h3>
          <div className="mb-3 text-slate-500" style={{ fontSize: "0.75rem" }}>
            {t(
              `نجح ${lastResponse.succeededCount || 0} | فشل ${lastResponse.failedCount || 0}`,
              `${lastResponse.succeededCount || 0} succeeded | ${lastResponse.failedCount || 0} failed`
            )}
          </div>
          <div className="space-y-2">
            {lastResponse.results.map((result) => (
              <div key={`${result.accountId}-${result.platformId}`} className="rounded-xl bg-slate-50 p-3" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 min-w-0">
                    {getPlatformIcon(result.platformId, 16)}
                    <span className="text-slate-700 truncate" style={{ fontSize: "0.75rem" }}>
                      {result.accountName}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${
                      result.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    }`}
                    style={{ fontSize: "0.6875rem" }}
                  >
                    {result.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{result.success ? t("ناجح", "Success") : t("فشل", "Failed")}</span>
                  </span>
                </div>
                {result.error ? (
                  <p className="text-red-600 mt-1.5" style={{ fontSize: "0.6875rem" }}>
                    {result.error}
                  </p>
                ) : null}
                {result.url ? (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-600 mt-1.5 inline-block"
                    style={{ fontSize: "0.6875rem" }}
                  >
                    {t("فتح الرابط", "Open post URL")}
                  </a>
                ) : null}
                {result.scheduledFor ? (
                  <p className="text-slate-400 mt-1.5" style={{ fontSize: "0.6875rem" }}>
                    {t("وقت الجدولة:", "Scheduled for:")} {formatDateTime(result.scheduledFor, language)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
