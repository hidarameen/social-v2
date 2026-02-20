import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Shield, Loader2, CheckCircle, Smartphone } from "lucide-react";
import { getPlatformIcon, platforms, type PlatformInfo, type PlatformType } from "./PlatformIcons";
import { apiRequest } from "../services/api";
import { useTheme } from "../context/ThemeContext";

const COUNTRY_DIAL_CODES = [
  { value: "+1", label: "US +1", flag: "🇺🇸" },
  { value: "+44", label: "UK +44", flag: "🇬🇧" },
  { value: "+49", label: "DE +49", flag: "🇩🇪" },
  { value: "+33", label: "FR +33", flag: "🇫🇷" },
  { value: "+39", label: "IT +39", flag: "🇮🇹" },
  { value: "+34", label: "ES +34", flag: "🇪🇸" },
  { value: "+90", label: "TR +90", flag: "🇹🇷" },
  { value: "+966", label: "SA +966", flag: "🇸🇦" },
  { value: "+971", label: "AE +971", flag: "🇦🇪" },
  { value: "+20", label: "EG +20", flag: "🇪🇬" },
  { value: "+964", label: "IQ +964", flag: "🇮🇶" },
  { value: "+963", label: "SY +963", flag: "🇸🇾" },
  { value: "+962", label: "JO +962", flag: "🇯🇴" },
  { value: "+974", label: "QA +974", flag: "🇶🇦" },
  { value: "+965", label: "KW +965", flag: "🇰🇼" },
];

type ConnectFormState = {
  accountName: string;
  accountUsername: string;
  accessToken: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  clientSecret: string;
  accessTokenSecret: string;
  bearerToken: string;
  webhookSecret: string;
  pageId: string;
  channelId: string;
  botToken: string;
  phoneCountryCode: string;
  phoneNumber: string;
  phoneCode: string;
  twoFactorPassword: string;
};

const EMPTY_FORM: ConnectFormState = {
  accountName: "",
  accountUsername: "",
  accessToken: "",
  apiKey: "",
  apiSecret: "",
  clientId: "",
  clientSecret: "",
  accessTokenSecret: "",
  bearerToken: "",
  webhookSecret: "",
  pageId: "",
  channelId: "",
  botToken: "",
  phoneCountryCode: "+1",
  phoneNumber: "",
  phoneCode: "",
  twoFactorPassword: "",
};

type ConnectFieldKey = keyof Omit<
  ConnectFormState,
  | "accountName"
  | "accountUsername"
  | "phoneCountryCode"
  | "phoneNumber"
  | "phoneCode"
  | "twoFactorPassword"
  | "pageId"
  | "channelId"
>;

type ApiFieldConfig = {
  key: ConnectFieldKey;
  label: string;
  secret?: boolean;
  placeholder: string;
};

const COMMON_API_FIELDS: ApiFieldConfig[] = [
  { key: "clientId", label: "Client ID", placeholder: "App client id" },
  { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "App client secret" },
  { key: "apiKey", label: "API Key", placeholder: "API key" },
  { key: "apiSecret", label: "API Secret", secret: true, placeholder: "API secret" },
];

function getApiFields(platformId: PlatformInfo["id"]): ApiFieldConfig[] {
  if (platformId === "twitter") {
    return [
      ...COMMON_API_FIELDS,
      { key: "accessTokenSecret", label: "Access Token Secret", secret: true, placeholder: "OAuth1 token secret" },
      { key: "bearerToken", label: "Bearer Token", secret: true, placeholder: "Streaming bearer token" },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, placeholder: "Webhook/API secret" },
    ];
  }
  if (platformId === "telegram") {
    return [{ key: "botToken", label: "Bot Token", secret: true, placeholder: "Optional bot token" }];
  }
  return COMMON_API_FIELDS;
}

function trimValue(value: string): string {
  return String(value || "").trim();
}

function compactCredentials(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = trimValue(value);
    if (normalized) output[key] = normalized;
  }
  return output;
}

export interface ConnectPayload {
  accountName?: string;
  accountUsername?: string;
  accountId?: string;
  accessToken?: string;
  credentials?: Record<string, unknown>;
  platformCredentialPayload?: Record<string, string>;
}

interface ConnectModalProps {
  platform: PlatformInfo | null;
  isOpen: boolean;
  onClose: () => void;
  connectedPlatforms?: PlatformType[];
  onSelectPlatform?: (platform: PlatformInfo | null) => void;
  onConnect: (platform: PlatformInfo, payload: ConnectPayload) => Promise<void> | void;
}

export function ConnectModal({
  platform,
  isOpen,
  onClose,
  connectedPlatforms = [],
  onSelectPlatform,
  onConnect,
}: ConnectModalProps) {
  const { language, t } = useTheme();
  const [form, setForm] = useState<ConnectFormState>(EMPTY_FORM);
  const [telegramAuthId, setTelegramAuthId] = useState("");
  const [telegramNeedsPassword, setTelegramNeedsPassword] = useState(false);
  const [telegramPasswordHint, setTelegramPasswordHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<"idle" | "preparing" | "authorizing" | "redirecting">("idle");
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const currentApiFields = useMemo(() => (platform ? getApiFields(platform.id) : []), [platform]);

  const telegramFullPhoneNumber = useMemo(() => {
    const countryCode = trimValue(form.phoneCountryCode).replace(/\s+/g, "");
    const localDigits = form.phoneNumber.replace(/\D/g, "");
    if (!countryCode || !localDigits) return "";
    const normalizedCountry = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
    return `${normalizedCountry}${localDigits}`;
  }, [form.phoneCountryCode, form.phoneNumber]);

  useEffect(() => {
    if (!isOpen || !platform) return;
    setForm(EMPTY_FORM);
    setTelegramAuthId("");
    setTelegramNeedsPassword(false);
    setTelegramPasswordHint("");
    setErrorText("");
    setNoticeText("");

    let cancelled = false;
    setIsLoadingCredentials(true);
    void apiRequest<any>(`/api/platform-credentials?platformId=${platform.id}`)
      .then((payload) => {
        if (cancelled) return;
        const credentials = payload?.credentials || {};
        setForm((prev) => ({
          ...prev,
          clientId: trimValue(credentials.clientId),
          clientSecret: trimValue(credentials.clientSecret),
          apiKey: trimValue(credentials.apiKey),
          apiSecret: trimValue(credentials.apiSecret),
          accessToken: trimValue(credentials.accessToken),
          accessTokenSecret: trimValue(credentials.accessTokenSecret),
          bearerToken: trimValue(credentials.bearerToken),
          webhookSecret: trimValue(credentials.webhookSecret),
          botToken: trimValue(credentials.botToken),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setNoticeText(t("لم يتم العثور على مفاتيح محفوظة لهذه المنصة.", "No saved credentials were found for this platform."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCredentials(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, platform]);

  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setConnectionStep("idle");
    }
  }, [isOpen]);

  useEffect(() => {
    setConnectionStep("idle");
  }, [platform?.id]);

  const getPermissions = (targetPlatform: PlatformInfo) => {
    const base = ["قراءة معلومات الحساب", "تنفيذ النشر التلقائي"];
    if (targetPlatform.id === "telegram") {
      return [...base, "تسجيل دخول تيليجرام عبر رقم الهاتف", "التحقق بخطوتين عند الحاجة"];
    }
    return [...base, "استخدام مفاتيح API/Token الخاصة بك", "الوصول إلى إحصائيات النشر"];
  };

  const updateField = <T extends keyof ConnectFormState>(key: T, value: ConnectFormState[T]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPlatformCredentialPayload = () =>
    compactCredentials({
      clientId: form.clientId,
      clientSecret: form.clientSecret,
      apiKey: form.apiKey,
      apiSecret: form.apiSecret,
      accessToken: form.accessToken,
      accessTokenSecret: form.accessTokenSecret,
      bearerToken: form.bearerToken,
      webhookSecret: form.webhookSecret,
      botToken: form.botToken,
    });

  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const handleStartTelegramAuth = async () => {
    if (!telegramFullPhoneNumber) {
      setErrorText("يرجى إدخال رقم الهاتف مع رمز الدولة.");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");
    setNoticeText("");
    try {
      const payload = await apiRequest<any>("/api/telegram/auth", {
        method: "POST",
        body: {
          action: "start",
          phoneNumber: telegramFullPhoneNumber,
        },
      });
      const authId = trimValue(payload?.authId);
      if (!authId) {
        throw new Error("تعذر بدء جلسة التحقق.");
      }
      setTelegramAuthId(authId);
      setTelegramNeedsPassword(false);
      setTelegramPasswordHint("");
      setNoticeText(t("تم إرسال كود التحقق. أدخل الكود لإكمال الربط.", "Verification code sent. Enter it to complete connection."));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "فشل إرسال كود تيليجرام.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyTelegramAuth = async () => {
    if (!telegramAuthId) {
      setErrorText("ابدأ أولاً بإرسال كود التحقق.");
      return;
    }
    if (!trimValue(form.phoneCode)) {
      setErrorText("يرجى إدخال كود التحقق.");
      return;
    }
    if (telegramNeedsPassword && !trimValue(form.twoFactorPassword)) {
      setErrorText("يرجى إدخال كلمة مرور التحقق بخطوتين.");
      return;
    }

    setIsSubmitting(true);
    setErrorText("");
    setNoticeText("");
    try {
      const verifyPayload = await apiRequest<any>("/api/telegram/auth", {
        method: "POST",
        body: {
          action: "verify",
          authId: telegramAuthId,
          phoneCode: trimValue(form.phoneCode),
          password: telegramNeedsPassword ? trimValue(form.twoFactorPassword) : undefined,
        },
      });

      if (verifyPayload?.requiresPassword || verifyPayload?.step === "password_required") {
        setTelegramNeedsPassword(true);
        setTelegramPasswordHint(trimValue(verifyPayload?.hint));
        setNoticeText(t("الحساب يتطلب كلمة مرور 2FA. أدخل كلمة مرور تيليجرام السحابية.", "This account requires 2FA password. Enter Telegram cloud password."));
        return;
      }

      const profile = verifyPayload?.profile;
      const sessionString = trimValue(profile?.sessionString);
      if (!sessionString) {
        throw new Error("لم يتم إنشاء جلسة تيليجرام صالحة.");
      }

      await onConnect(platform, {
        accountName: trimValue(profile?.accountName) || "Telegram User",
        accountUsername: trimValue(profile?.accountUsername) || "telegram_user",
        accountId: trimValue(profile?.accountId),
        accessToken: sessionString,
        credentials: {
          authType: "user_session",
          sessionString,
          phoneNumber: trimValue(profile?.phoneNumber) || telegramFullPhoneNumber,
          accountInfo: {
            id: trimValue(profile?.accountId),
            username: trimValue(profile?.accountUsername),
            name: trimValue(profile?.accountName),
            isBot: false,
            phoneNumber: trimValue(profile?.phoneNumber) || telegramFullPhoneNumber,
          },
        },
      });

      setNoticeText(t("تم ربط حساب تيليجرام بنجاح.", "Telegram account connected successfully."));
      onClose();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "فشل التحقق من تيليجرام.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthConnect = async () => {
    setIsSubmitting(true);
    setConnectionStep("preparing");
    setErrorText("");
    setNoticeText("");
    try {
      await wait(180);
      setConnectionStep("authorizing");
      await wait(220);
      await onConnect(platform, {
        platformCredentialPayload: buildPlatformCredentialPayload(),
      });
      setConnectionStep("redirecting");
      setNoticeText(t("جاري تحويلك لإكمال الربط...", "Redirecting to complete the connection..."));
      onClose();
    } catch (error) {
      setConnectionStep("idle");
      setErrorText(error instanceof Error ? error.message : "تعذر بدء عملية الربط.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!platform) {
      setErrorText(t("اختر منصة أولاً.", "Select a platform first."));
      return;
    }
    if (platform.id === "telegram") {
      if (!telegramAuthId) {
        await handleStartTelegramAuth();
        return;
      }
      await handleVerifyTelegramAuth();
      return;
    }
    await handleOAuthConnect();
  };

  const actionLabel = !platform
    ? t("اختر منصة", "Select Platform")
    : platform.id === "telegram"
      ? !telegramAuthId
        ? t("إرسال الكود", "Send Code")
        : telegramNeedsPassword
          ? t("تأكيد كلمة المرور", "Confirm Password")
          : t("تأكيد الكود", "Confirm Code")
      : t("ربط الحساب", "Connect Account");

  const nonTelegramSavedKeyCount = currentApiFields.reduce(
    (count, field) => (trimValue(form[field.key]) ? count + 1 : count),
    0
  );
  const oauthStepOrder: Array<"preparing" | "authorizing" | "redirecting"> = [
    "preparing",
    "authorizing",
    "redirecting",
  ];
  const oauthStepLabels = {
    preparing: t("تهيئة الطلب", "Preparing request"),
    authorizing: t("بدء المصادقة", "Starting authorization"),
    redirecting: t("التحويل للمنصة", "Redirecting to platform"),
  } as const;
  const currentOauthStepIndex =
    connectionStep === "idle" ? -1 : oauthStepOrder.indexOf(connectionStep as (typeof oauthStepOrder)[number]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
          style={{ zIndex: 100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`relative w-full ${platform ? "max-w-md" : "max-w-2xl"} rounded-3xl overflow-hidden bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto`}
            style={{
              boxShadow: `0 25px 60px rgba(0,0,0,0.15), 0 0 40px ${platform ? platform.bgGlow : "rgba(139,92,246,0.14)"}`,
            }}
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            <motion.div
              className={`h-1.5 bg-gradient-to-r ${platform ? platform.gradient : "from-violet-500 via-purple-500 to-pink-500"}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ transformOrigin: language === "ar" ? "right" : "left" }}
            />

            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 z-10"
            >
              <X className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            </button>

            {!platform ? (
              <div className="p-6 sm:p-8 pt-12">
                <div className="text-center mb-5">
                  <h2 className="text-slate-800 dark:text-slate-100 mb-1.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {t("اختر المنصة", "Choose Platform")}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: "0.875rem" }}>
                    {t("اختر منصة لفتح لوحة الربط مباشرة بدون نوافذ متكررة.", "Select a platform to open one persistent connect panel.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {platforms.map((item, i) => {
                    const isConnected = connectedPlatforms.includes(item.id);
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        className="text-left rounded-2xl p-3.5 bg-white border border-slate-200 hover:border-violet-300 hover:bg-slate-50 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setErrorText("");
                          setNoticeText("");
                          onSelectPlatform?.(item);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${item.bgGlow}, rgba(248,250,252,0.8))`, border: `1px solid ${item.bgGlow}` }}>
                            {getPlatformIcon(item.id, 20)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="inline-flex items-center gap-1.5">
                              <p className="text-slate-700 truncate" style={{ fontSize: "0.84rem" }}>
                                {item.name}
                              </p>
                              {isConnected ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : null}
                            </div>
                            <p className="text-slate-400 truncate" style={{ fontSize: "0.72rem" }}>
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 pt-12">
                <div className="text-center">
                  <motion.div
                    className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${platform.bgGlow}, rgba(248,250,252,0.8))`,
                      border: `1px solid ${platform.bgGlow}`,
                    }}
                    animate={{
                      boxShadow: [
                        `0 4px 15px ${platform.bgGlow}`,
                        `0 8px 30px ${platform.bgGlow}`,
                        `0 4px 15px ${platform.bgGlow}`,
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {getPlatformIcon(platform.id, 40)}
                  </motion.div>

                  <h2 className="text-slate-800 dark:text-slate-100 mb-1.5" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                    {t(`ربط حساب ${platform.name}`, `Connect ${platform.name}`)}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-5" style={{ fontSize: "0.875rem" }}>
                    {platform.id === "telegram"
                      ? t("تسجيل دخول تيليجرام عبر رقم الهاتف بنفس منطق النسخة السابقة.", "Telegram login via phone number using the same previous logic.")
                      : t("الربط يتم تلقائياً باستخدام مفاتيح API المحفوظة وطريقة API المحددة من الإعدادات.", "Connection runs automatically using saved API credentials and configured API method.")}
                  </p>
                  {onSelectPlatform ? (
                    <button
                      type="button"
                      onClick={() => onSelectPlatform(null)}
                      className="mb-4 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                      style={{ fontSize: "0.72rem" }}
                    >
                      {t("تغيير المنصة", "Change platform")}
                    </button>
                  ) : null}
                </div>

                <div className="space-y-3 mb-5">
                  {getPermissions(platform).map((permission) => (
                    <div
                      key={permission}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200/70 dark:border-slate-600"
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300" style={{ fontSize: "0.75rem" }}>
                        {permission}
                      </span>
                    </div>
                  ))}
                </div>

                {isLoadingCredentials && (
                  <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-slate-500 dark:text-slate-300 text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("جاري تحميل مفاتيح API المحفوظة...", "Loading saved API credentials...")}
                  </div>
                )}

                {errorText && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-600 text-xs">
                    {errorText}
                  </div>
                )}

                {noticeText && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {noticeText}
                  </div>
                )}

                {platform.id !== "telegram" ? (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    {oauthStepOrder.map((step, index) => {
                      const done = currentOauthStepIndex > index;
                      const active = currentOauthStepIndex === index;
                      return (
                        <div
                          key={step}
                          className={`flex items-center gap-2 text-xs ${
                            done ? "text-emerald-700" : active ? "text-blue-700" : "text-slate-400"
                          }`}
                        >
                          {done ? (
                            <CheckCircle className="w-3.5 h-3.5" />
                          ) : active ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" />
                          )}
                          <span>{oauthStepLabels[step]}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {platform.id === "telegram" ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-300 mb-1.5" style={{ fontSize: "0.8125rem" }}>
                        {t("رقم الهاتف", "Phone Number")}
                      </label>
                      <div className="grid grid-cols-[140px_1fr] gap-2">
                        <select
                          value={form.phoneCountryCode}
                          onChange={(event) => updateField("phoneCountryCode", event.target.value)}
                          className="py-2.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400"
                          style={{ fontSize: "0.8125rem" }}
                        >
                          {COUNTRY_DIAL_CODES.map((country) => (
                            <option key={country.value} value={country.value}>
                              {country.flag} {country.label}
                            </option>
                          ))}
                        </select>
                        <div className="relative">
                          <Smartphone className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={form.phoneNumber}
                            onChange={(event) => updateField("phoneNumber", event.target.value)}
                            placeholder="7xxxxxxxx"
                            className="w-full py-2.5 px-3 pr-9 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400"
                            style={{ fontSize: "0.875rem" }}
                          />
                        </div>
                      </div>
                    </div>

                    {telegramAuthId && (
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 mb-1.5" style={{ fontSize: "0.8125rem" }}>
                          {t("كود التحقق", "Verification Code")}
                        </label>
                        <input
                          type="text"
                          value={form.phoneCode}
                          onChange={(event) => updateField("phoneCode", event.target.value)}
                          placeholder="12345"
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400"
                          style={{ fontSize: "0.875rem" }}
                        />
                      </div>
                    )}

                    {telegramNeedsPassword && (
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 mb-1.5" style={{ fontSize: "0.8125rem" }}>
                          {t("كلمة مرور 2FA", "2FA Password")}
                        </label>
                        <input
                          type="password"
                          value={form.twoFactorPassword}
                          onChange={(event) => updateField("twoFactorPassword", event.target.value)}
                          placeholder={telegramPasswordHint ? `Hint: ${telegramPasswordHint}` : "Telegram cloud password"}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400"
                          style={{ fontSize: "0.875rem" }}
                          dir="ltr"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/40 p-3">
                      <p className="text-slate-700 dark:text-slate-200" style={{ fontSize: "0.8125rem" }}>
                        {t("سيتم استخدام المفاتيح المحفوظة تلقائياً لهذه المنصة ثم استخراج بيانات الحساب بدون إدخال يدوي.", "Saved credentials will be used automatically for this platform and account data will be fetched without manual input.")}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 mt-1" style={{ fontSize: "0.75rem" }}>
                        {t(`المفاتيح المكتشفة: ${nonTelegramSavedKeyCount}`, `Detected keys: ${nonTelegramSavedKeyCount}`)}
                      </p>
                      {nonTelegramSavedKeyCount === 0 ? (
                        <p className="text-amber-600 mt-1" style={{ fontSize: "0.75rem" }}>
                          {t("لم يتم العثور على مفاتيح منصة محفوظة. تأكد من إعدادها من صفحة Settings.", "No saved platform keys found. Make sure they are configured in Settings.")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                <motion.button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full mt-6 py-3.5 rounded-2xl text-white relative overflow-hidden disabled:opacity-65"
                  style={{
                    background: platform.color === "#FFFC00" || platform.color === "#14171A" ? "#1e293b" : platform.color,
                    boxShadow: `0 4px 20px ${platform.bgGlow}`,
                  }}
                  whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    {actionLabel}
                  </span>
                </motion.button>

                <p className="mt-3 text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1" style={{ fontSize: "0.75rem" }}>
                  <Shield className="w-3 h-3" />
                  {t("اتصال آمن ومشفر", "Secure encrypted connection")}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
