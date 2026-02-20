import {
  User, Lock, Key, Bell, Shield, Globe, Palette, Smartphone,
  Save, Eye, EyeOff, Camera, CheckCircle, Copy, Plus, Trash2,
  ChevronDown, AlertTriangle, Monitor, Moon, Sun, Languages,
  LogOut, Download, RefreshCw, Info, Zap, Clock, Mail, FileText,
  Check, X
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { platforms, type PlatformType } from "../PlatformIcons";
import { getPlatformIcon } from "../PlatformIcons";
import { toast } from "sonner";

type SettingsTab = "profile" | "security" | "apikeys" | "notifications" | "general" | "about";

const tabs: { id: SettingsTab; labelAr: string; labelEn: string; icon: typeof User }[] = [
  { id: "profile", labelAr: "الملف الشخصي", labelEn: "Profile", icon: User },
  { id: "security", labelAr: "الأمان", labelEn: "Security", icon: Shield },
  { id: "apikeys", labelAr: "مفاتيح API", labelEn: "API Keys", icon: Key },
  { id: "notifications", labelAr: "الإشعارات", labelEn: "Notifications", icon: Bell },
  { id: "general", labelAr: "عام", labelEn: "General", icon: Globe },
  { id: "about", labelAr: "حول التطبيق", labelEn: "About", icon: Info },
];

interface ApiKeyEntry {
  platform: PlatformType;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  isVisible: boolean;
  connected: boolean;
}

export function SettingsPageFull() {
  const { user } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage, t } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "+966 5XX XXX XXXX",
    bio: "مدير تسويق رقمي | متخصص في إدارة حسابات التواصل الاجتماعي",
    company: "شركة التقنية المتقدمة",
    website: "https://socialhub.app",
    timezone: "Asia/Riyadh (GMT+3)",
    avatar: user?.avatar || "",
  });

  // Security state
  const [passwordData, setPasswordData] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [twoFactor, setTwoFactor] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>(
    platforms.map((p) => ({
      platform: p.id,
      apiKey: "",
      apiSecret: "",
      accessToken: "",
      isVisible: false,
      connected: ["facebook", "instagram", "twitter"].includes(p.id),
    }))
  );
  const [expandedPlatform, setExpandedPlatform] = useState<PlatformType | null>(null);

  // Notifications state
  const [notifSettings, setNotifSettings] = useState({
    email: true,
    push: true,
    taskComplete: true,
    taskFailed: true,
    weeklyReport: true,
    newFeatures: false,
    accountAlerts: true,
    securityAlerts: true,
    marketingEmails: false,
    sound: true,
  });

  // General state
  const [generalSettings, setGeneralSettings] = useState({
    autoSave: true,
    animations: true,
    compactMode: false,
    showTips: true,
    dataRetention: "90",
    defaultPlatform: "instagram" as PlatformType,
    autoRefresh: true,
    refreshInterval: "30",
    confirmDelete: true,
    showPreview: true,
  });

  const handleSave = () => {
    setSaved(true);
    toast.success(t("تم حفظ الإعدادات بنجاح", "Settings saved successfully"));
    setTimeout(() => setSaved(false), 2000);
  };

  const maskKey = (key: string) => {
    if (!key) return "—";
    if (key.length <= 8) return "••••••••";
    return key.slice(0, 4) + "••••••••" + key.slice(-4);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("تم النسخ", "Copied"));
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strengthLabels = [
    { label: t("ضعيفة جداً", "Very Weak"), color: "bg-red-500" },
    { label: t("ضعيفة", "Weak"), color: "bg-orange-500" },
    { label: t("متوسطة", "Medium"), color: "bg-yellow-500" },
    { label: t("قوية", "Strong"), color: "bg-blue-500" },
    { label: t("قوية جداً", "Very Strong"), color: "bg-emerald-500" },
  ];

  const renderProfile = () => (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Avatar Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("الصورة الشخصية", "Profile Picture")}
        </h3>
        <div className="flex items-center gap-4">
          <motion.div className="relative group cursor-pointer" whileHover={{ scale: 1.05 }} onClick={() => fileInputRef.current?.click()}>
            {profileData.avatar ? (
              <img src={profileData.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-600" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <span className="text-violet-600 dark:text-violet-400" style={{ fontSize: "1.5rem" }}>{profileData.name.charAt(0)}</span>
              </div>
            )}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Camera className="w-6 h-6 text-white" />
            </motion.div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={() => toast.info(t("تم تحديد الصورة (محاكاة)", "Image selected (simulated)"))} />
          </motion.div>
          <div>
            <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.875rem" }}>{profileData.name}</p>
            <p className="text-slate-400" style={{ fontSize: "0.75rem" }}>{profileData.email}</p>
            <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30">
              <Zap className="w-3 h-3 text-violet-600 dark:text-violet-400" />
              <span className="text-violet-700 dark:text-violet-300" style={{ fontSize: "0.625rem" }}>Pro</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("المعلومات الشخصية", "Personal Information")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: t("الاسم الكامل", "Full Name"), key: "name", type: "text", icon: User },
            { label: t("البريد الإلكتروني", "Email"), key: "email", type: "email", icon: Mail, dir: "ltr" },
            { label: t("رقم الهاتف", "Phone"), key: "phone", type: "tel", icon: Smartphone, dir: "ltr" },
            { label: t("الشركة", "Company"), key: "company", type: "text", icon: Globe },
            { label: t("الموقع الإلكتروني", "Website"), key: "website", type: "url", icon: Globe, dir: "ltr" },
            { label: t("المنطقة الزمنية", "Timezone"), key: "timezone", type: "text", icon: Clock },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-slate-600 dark:text-slate-400 mb-1.5" style={{ fontSize: "0.8125rem" }}>{field.label}</label>
              <div className="relative">
                <field.icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={field.type}
                  value={(profileData as any)[field.key]}
                  onChange={(e) => setProfileData((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full py-2.5 pr-10 pl-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
                  style={{ fontSize: "0.875rem" }}
                  dir={field.dir || undefined}
                />
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-slate-600 dark:text-slate-400 mb-1.5" style={{ fontSize: "0.8125rem" }}>{t("النبذة", "Bio")}</label>
            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData((p) => ({ ...p, bio: e.target.value }))}
              rows={3}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all resize-none"
              style={{ fontSize: "0.875rem" }}
            />
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("معلومات الحساب", "Account Info")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: t("تاريخ الانضمام", "Joined"), value: user?.joinedAt || "2025/06", icon: Clock },
            { label: t("الخطة", "Plan"), value: "Pro", icon: Zap },
            { label: t("طريقة التسجيل", "Sign-up Method"), value: user?.provider === "email" ? t("بريد إلكتروني", "Email") : user?.provider || "email", icon: Shield },
          ].map((info, i) => (
            <motion.div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="flex items-center gap-2 mb-1">
                <info.icon className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500" style={{ fontSize: "0.75rem" }}>{info.label}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200" style={{ fontSize: "0.875rem" }}>{info.value}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderSecurity = () => {
    const strength = getPasswordStrength(passwordData.newPass);
    return (
      <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Change Password */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h3 className="text-slate-800 dark:text-slate-200" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
              {t("تغيير كلمة المرور", "Change Password")}
            </h3>
          </div>
          <div className="space-y-4 max-w-md">
            {[
              { key: "current", label: t("كلمة المرور الحالية", "Current Password"), show: showPasswords.current, toggle: "current" },
              { key: "newPass", label: t("كلمة المرور الجديدة", "New Password"), show: showPasswords.new, toggle: "new" },
              { key: "confirm", label: t("تأكيد كلمة المرور", "Confirm Password"), show: showPasswords.confirm, toggle: "confirm" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-slate-600 dark:text-slate-400 mb-1.5" style={{ fontSize: "0.8125rem" }}>{field.label}</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={field.show ? "text" : "password"}
                    value={(passwordData as any)[field.key]}
                    onChange={(e) => setPasswordData((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="w-full py-2.5 pr-10 pl-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
                    style={{ fontSize: "0.875rem" }}
                    dir="ltr"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((p) => ({ ...p, [field.toggle]: !(p as any)[field.toggle] }))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}

            {/* Password Strength */}
            {passwordData.newPass && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-500" style={{ fontSize: "0.75rem" }}>{t("قوة كلمة المرور:", "Password Strength:")}</span>
                  <span className={`${strength >= 4 ? "text-emerald-600" : strength >= 3 ? "text-blue-600" : strength >= 2 ? "text-yellow-600" : "text-red-600"}`} style={{ fontSize: "0.75rem" }}>
                    {strengthLabels[Math.min(strength, 4)]?.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthLabels[Math.min(strength - 1, 4)]?.color : "bg-slate-200 dark:bg-slate-600"}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: i * 0.1 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {passwordData.confirm && passwordData.newPass !== passwordData.confirm && (
              <motion.p className="text-red-500 flex items-center gap-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <AlertTriangle className="w-3 h-3" /> {t("كلمات المرور غير متطابقة", "Passwords don't match")}
              </motion.p>
            )}

            <motion.button
              onClick={() => {
                if (!passwordData.current || !passwordData.newPass || !passwordData.confirm) {
                  toast.error(t("جميع الحقول مطلوبة", "All fields are required"));
                  return;
                }
                if (passwordData.newPass !== passwordData.confirm) {
                  toast.error(t("كلمات المرور غير متطابقة", "Passwords don't match"));
                  return;
                }
                toast.success(t("تم تغيير كلمة المرور بنجاح", "Password changed successfully"));
                setPasswordData({ current: "", newPass: "", confirm: "" });
              }}
              className="px-6 py-2.5 rounded-xl bg-slate-800 dark:bg-violet-600 text-white flex items-center gap-2"
              style={{ fontSize: "0.8125rem", boxShadow: "0 4px 15px rgba(15,23,42,0.2)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Lock className="w-4 h-4" />
              <span>{t("تحديث كلمة المرور", "Update Password")}</span>
            </motion.button>
          </div>
        </div>

        {/* Two-Factor & Login Alerts */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
            {t("أمان إضافي", "Additional Security")}
          </h3>
          <div className="space-y-4">
            <ToggleSwitch
              label={t("المصادقة الثنائية (2FA)", "Two-Factor Authentication")}
              desc={t("طبقة حماية إضافية عند تسجيل الدخول", "Extra security layer on login")}
              checked={twoFactor}
              onChange={setTwoFactor}
            />
            <ToggleSwitch
              label={t("تنبيهات تسجيل الدخول", "Login Alerts")}
              desc={t("إشعار عند تسجيل دخول من جهاز جديد", "Alert on login from new device")}
              checked={loginAlerts}
              onChange={setLoginAlerts}
            />
          </div>
        </div>

        {/* Active Sessions */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
            {t("الجلسات النشطة", "Active Sessions")}
          </h3>
          <div className="space-y-3">
            {[
              { device: t("هذا الجهاز — Chrome", "This Device — Chrome"), time: t("الآن", "Now"), current: true },
              { device: "iPhone 15 — Safari", time: t("منذ ساعتين", "2 hours ago"), current: false },
              { device: "iPad Air — Safari", time: t("منذ يوم", "1 day ago"), current: false },
            ].map((session, i) => (
              <motion.div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-700/30"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.8125rem" }}>{session.device}</p>
                    <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{session.time}</p>
                  </div>
                </div>
                {session.current ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" style={{ fontSize: "0.625rem" }}>
                    {t("نشط", "Active")}
                  </span>
                ) : (
                  <button className="text-red-500 hover:text-red-600 transition-colors" style={{ fontSize: "0.75rem" }}
                    onClick={() => toast.success(t("تم إنهاء الجلسة", "Session terminated"))}>
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderApiKeys = () => (
    <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20" style={{ border: "1px solid rgba(245,158,11,0.15)" }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-amber-700 dark:text-amber-300" style={{ fontSize: "0.8125rem" }}>
            {t(
              "احتفظ بمفاتيح API سرية. لا تشاركها مع أحد. يتم تشفيرها وتخزينها بشكل آمن.",
              "Keep your API keys secret. Never share them. They are encrypted and stored securely."
            )}
          </p>
        </div>
      </div>

      {platforms.map((platform, idx) => {
        const keyEntry = apiKeys.find((k) => k.platform === platform.id);
        const isExpanded = expandedPlatform === platform.id;

        return (
          <motion.div
            key={platform.id}
            className="rounded-2xl bg-white dark:bg-slate-800/50 overflow-hidden"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
          >
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
              onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
            >
              <div className="flex items-center gap-3">
                {getPlatformIcon(platform.id, 24)}
                <div className="text-right">
                  <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.875rem" }}>{platform.name}</p>
                  <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{platform.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {keyEntry?.connected && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" style={{ fontSize: "0.625rem" }}>
                    {t("مربوط", "Connected")}
                  </span>
                )}
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                    {[
                      { label: "API Key", key: "apiKey" },
                      { label: "API Secret", key: "apiSecret" },
                      { label: "Access Token", key: "accessToken" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-slate-500 mb-1" style={{ fontSize: "0.75rem" }}>{field.label}</label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type={keyEntry?.isVisible ? "text" : "password"}
                              value={(keyEntry as any)?.[field.key] || ""}
                              onChange={(e) => {
                                setApiKeys((prev) =>
                                  prev.map((k) => k.platform === platform.id ? { ...k, [field.key]: e.target.value } : k)
                                );
                              }}
                              placeholder={`${t("أدخل", "Enter")} ${field.label}...`}
                              className="w-full py-2 pr-9 pl-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
                              style={{ fontSize: "0.8125rem", fontFamily: "monospace" }}
                              dir="ltr"
                            />
                          </div>
                          <button
                            onClick={() => setApiKeys((prev) => prev.map((k) => k.platform === platform.id ? { ...k, isVisible: !k.isVisible } : k))}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 transition-colors"
                          >
                            {keyEntry?.isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard((keyEntry as any)?.[field.key] || "")}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-400 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <motion.button
                        onClick={() => {
                          setApiKeys((prev) => prev.map((k) => k.platform === platform.id ? { ...k, connected: true } : k));
                          toast.success(t(`تم حفظ مفاتيح ${platform.name}`, `${platform.name} keys saved`));
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-violet-600 text-white flex items-center gap-1.5"
                        style={{ fontSize: "0.8125rem" }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {t("حفظ", "Save")}
                      </motion.button>
                      {keyEntry?.connected && (
                        <motion.button
                          onClick={() => {
                            setApiKeys((prev) => prev.map((k) => k.platform === platform.id ? { ...k, apiKey: "", apiSecret: "", accessToken: "", connected: false } : k));
                            toast.success(t("تم حذف المفاتيح", "Keys deleted"));
                          }}
                          className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center gap-1.5"
                          style={{ fontSize: "0.8125rem" }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t("حذف", "Delete")}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );

  const renderNotifications = () => (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("قنوات الإشعار", "Notification Channels")}
        </h3>
        <div className="space-y-4">
          <ToggleSwitch label={t("إشعارات البريد", "Email Notifications")} desc={t("استلام إشعارات عبر البريد", "Receive via email")}
            checked={notifSettings.email} onChange={(v) => setNotifSettings((p) => ({ ...p, email: v }))} />
          <ToggleSwitch label={t("إشعارات الدفع", "Push Notifications")} desc={t("إشعارات فورية على الجهاز", "Instant device notifications")}
            checked={notifSettings.push} onChange={(v) => setNotifSettings((p) => ({ ...p, push: v }))} />
          <ToggleSwitch label={t("الأصوات", "Sounds")} desc={t("تشغيل صوت عند الإشعار", "Play sound on notification")}
            checked={notifSettings.sound} onChange={(v) => setNotifSettings((p) => ({ ...p, sound: v }))} />
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("أنواع الإشعارات", "Notification Types")}
        </h3>
        <div className="space-y-4">
          <ToggleSwitch label={t("إكمال المهام", "Task Complete")} desc={t("عند اكتمال تنفيذ مهمة أتمتة", "When task execution completes")}
            checked={notifSettings.taskComplete} onChange={(v) => setNotifSettings((p) => ({ ...p, taskComplete: v }))} />
          <ToggleSwitch label={t("فشل المهام", "Task Failed")} desc={t("عند فشل مهمة أتمتة", "When task execution fails")}
            checked={notifSettings.taskFailed} onChange={(v) => setNotifSettings((p) => ({ ...p, taskFailed: v }))} />
          <ToggleSwitch label={t("تقرير أسبوعي", "Weekly Report")} desc={t("ملخص أداء أسبوعي بالبريد", "Weekly performance summary via email")}
            checked={notifSettings.weeklyReport} onChange={(v) => setNotifSettings((p) => ({ ...p, weeklyReport: v }))} />
          <ToggleSwitch label={t("تنبيهات الحسابات", "Account Alerts")} desc={t("تنبيه عند انتهاء ربط حساب", "Alert when account connection expires")}
            checked={notifSettings.accountAlerts} onChange={(v) => setNotifSettings((p) => ({ ...p, accountAlerts: v }))} />
          <ToggleSwitch label={t("تنبيهات الأمان", "Security Alerts")} desc={t("تسجيل دخول من أجهزة جديدة", "Login from new devices")}
            checked={notifSettings.securityAlerts} onChange={(v) => setNotifSettings((p) => ({ ...p, securityAlerts: v }))} />
          <ToggleSwitch label={t("ميزات جديدة", "New Features")} desc={t("إشعار بالتحديثات والميزات الجديدة", "Updates & new features notification")}
            checked={notifSettings.newFeatures} onChange={(v) => setNotifSettings((p) => ({ ...p, newFeatures: v }))} />
        </div>
      </div>
    </motion.div>
  );

  const renderGeneral = () => (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {/* Appearance */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("المظهر واللغة", "Appearance & Language")}
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="w-5 h-5 text-violet-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.8125rem" }}>{t("وضع العرض", "Display Mode")}</p>
                <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                  {theme === "dark" ? t("الوضع الداكن", "Dark Mode") : t("الوضع الفاتح", "Light Mode")}
                </p>
              </div>
            </div>
            <motion.button
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${theme === "dark" ? "bg-violet-600" : "bg-slate-300"}`}
              style={{
                boxShadow: theme === "dark"
                  ? "inset 0 1px 1px rgba(0,0,0,0.06), 0 0 0 1px rgba(124,58,237,0.15)"
                  : "inset 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)"
              }}
              whileTap={{ scale: 0.95 }}
              role="switch"
              aria-checked={theme === "dark"}
            >
              <motion.div
                className="absolute top-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center"
                style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)" }}
                animate={{ x: theme === "dark" ? 28 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                <AnimatePresence mode="wait">
                  {theme === "dark" ? (
                    <motion.div key="moon" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
                      <Moon className="w-3.5 h-3.5 text-violet-600" />
                    </motion.div>
                  ) : (
                    <motion.div key="sun" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.15 }}>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.8125rem" }}>{t("اللغة", "Language")}</p>
                <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                  {language === "ar" ? "العربية" : "English"}
                </p>
              </div>
            </div>
            <motion.button
              onClick={toggleLanguage}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors"
              style={{ fontSize: "0.8125rem", border: "1px solid rgba(0,0,0,0.08)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {language === "ar" ? "English" : "العربية"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Behavior */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("السلوك", "Behavior")}
        </h3>
        <div className="space-y-4">
          <ToggleSwitch label={t("حفظ تلقائي", "Auto Save")} desc={t("حفظ التغييرات تلقائياً", "Save changes automatically")}
            checked={generalSettings.autoSave} onChange={(v) => setGeneralSettings((p) => ({ ...p, autoSave: v }))} />
          <ToggleSwitch label={t("الحركات والأنيميشن", "Animations")} desc={t("تأثيرات حركية في الواجهة", "UI motion effects")}
            checked={generalSettings.animations} onChange={(v) => setGeneralSettings((p) => ({ ...p, animations: v }))} />
          <ToggleSwitch label={t("الوضع المضغوط", "Compact Mode")} desc={t("تقليل المسافات لعرض المزيد", "Reduce spacing to show more")}
            checked={generalSettings.compactMode} onChange={(v) => setGeneralSettings((p) => ({ ...p, compactMode: v }))} />
          <ToggleSwitch label={t("نصائح وإرشادات", "Show Tips")} desc={t("عرض نصائح مفيدة أثناء الاستخدام", "Show helpful tips while using")}
            checked={generalSettings.showTips} onChange={(v) => setGeneralSettings((p) => ({ ...p, showTips: v }))} />
          <ToggleSwitch label={t("تحديث تلقائي", "Auto Refresh")} desc={t("تحديث البيانات تلقائياً", "Auto refresh data")}
            checked={generalSettings.autoRefresh} onChange={(v) => setGeneralSettings((p) => ({ ...p, autoRefresh: v }))} />
          <ToggleSwitch label={t("تأكيد الحذف", "Confirm Delete")} desc={t("طلب تأكيد قبل الحذف", "Ask confirmation before delete")}
            checked={generalSettings.confirmDelete} onChange={(v) => setGeneralSettings((p) => ({ ...p, confirmDelete: v }))} />
          <ToggleSwitch label={t("معاينة المحتوى", "Show Preview")} desc={t("عرض معاينة قبل النشر", "Preview before publishing")}
            checked={generalSettings.showPreview} onChange={(v) => setGeneralSettings((p) => ({ ...p, showPreview: v }))} />
        </div>
      </div>

      {/* Data */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-4" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("البيانات", "Data")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-slate-600 dark:text-slate-400 mb-1.5" style={{ fontSize: "0.8125rem" }}>
              {t("فترة الاحتفاظ بالسجلات (يوم)", "Log Retention Period (days)")}
            </label>
            <select
              value={generalSettings.dataRetention}
              onChange={(e) => setGeneralSettings((p) => ({ ...p, dataRetention: e.target.value }))}
              className="w-full sm:w-48 py-2.5 px-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all"
              style={{ fontSize: "0.875rem" }}
            >
              <option value="30">30 {t("يوم", "days")}</option>
              <option value="60">60 {t("يوم", "days")}</option>
              <option value="90">90 {t("يوم", "days")}</option>
              <option value="180">180 {t("يوم", "days")}</option>
              <option value="365">365 {t("يوم", "days")}</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <motion.button className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5" style={{ fontSize: "0.8125rem" }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => toast.success(t("جاري التصدير...", "Exporting..."))}>
              <Download className="w-3.5 h-3.5" /> {t("تصدير البيانات", "Export Data")}
            </motion.button>
            <motion.button className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1.5" style={{ fontSize: "0.8125rem" }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => toast.info(t("تم مسح الكاش", "Cache cleared"))}>
              <RefreshCw className="w-3.5 h-3.5" /> {t("مسح الكاش", "Clear Cache")}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-900/10" style={{ border: "1px solid rgba(220,38,38,0.15)" }}>
        <h3 className="text-red-700 dark:text-red-400 mb-2" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("منطقة الخطر", "Danger Zone")}
        </h3>
        <p className="text-red-500 dark:text-red-400 mb-4" style={{ fontSize: "0.8125rem" }}>
          {t("هذه الإجراءات لا يمكن التراجع عنها", "These actions are irreversible")}
        </p>
        <motion.button
          className="px-4 py-2 rounded-lg bg-red-600 text-white flex items-center gap-1.5"
          style={{ fontSize: "0.8125rem" }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toast.error(t("تم طلب حذف الحساب (محاكاة)", "Account deletion requested (simulated)"))}
        >
          <Trash2 className="w-3.5 h-3.5" /> {t("حذف الحساب نهائياً", "Delete Account Permanently")}
        </motion.button>
      </div>
    </motion.div>
  );

  const renderAbout = () => (
    <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50 text-center" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <motion.div
          className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            boxShadow: "0 10px 30px rgba(124,58,237,0.3)",
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L38 14V30L24 38L10 30V14L24 6Z" stroke="white" strokeWidth="2" fill="none" />
            <path d="M24 14L31 18V26L24 30L17 26V18L24 14Z" fill="white" fillOpacity="0.9" />
            <circle cx="24" cy="22" r="3" fill="rgba(124,58,237,0.8)" />
          </svg>
        </motion.div>
        <h2 className="text-slate-800 dark:text-slate-200 mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>SocialHub</h2>
        <p className="text-slate-400 mb-2" style={{ fontSize: "0.8125rem" }}>
          {t("منصة إدارة التواصل الاجتماعي الذكية", "Smart Social Media Management Platform")}
        </p>
        <p className="text-violet-600 dark:text-violet-400" style={{ fontSize: "0.75rem" }}>v2.0.0 — Flutter Ready</p>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("المنصات", "Platforms"), value: "12" },
            { label: t("الإصدار", "Version"), value: "2.0.0" },
            { label: t("الترخيص", "License"), value: "Pro" },
            { label: t("الحالة", "Status"), value: t("جاهز", "Ready") },
          ].map((item, i) => (
            <motion.div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{item.label}</p>
              <p className="text-slate-800 dark:text-slate-200" style={{ fontSize: "0.875rem", fontFamily: "Space Grotesk" }}>{item.value}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/50" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <h3 className="text-slate-800 dark:text-slate-200 mb-3" style={{ fontSize: "0.9375rem", fontFamily: language === "ar" ? "Cairo" : "Inter" }}>
          {t("التقنيات المستخدمة", "Technologies Used")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {["React", "TypeScript", "Tailwind CSS", "Motion", "React Router", "Recharts", "Sonner", "Flutter Ready"].map((tech, i) => (
            <motion.span key={tech} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400"
              style={{ fontSize: "0.75rem", border: "1px solid rgba(0,0,0,0.06)" }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
              {tech}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "profile": return renderProfile();
      case "security": return renderSecurity();
      case "apikeys": return renderApiKeys();
      case "notifications": return renderNotifications();
      case "general": return renderGeneral();
      case "about": return renderAbout();
    }
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Tabs */}
      <motion.div
        className="flex flex-wrap gap-2 p-1 rounded-xl bg-white dark:bg-slate-800/50"
        style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg transition-all ${
              activeTab === tab.id
                ? "bg-slate-800 dark:bg-violet-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30"
            }`}
            style={{ fontSize: "0.8125rem" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{language === "ar" ? tab.labelAr : tab.labelEn}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}>
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {/* Save Button */}
      {activeTab !== "about" && (
        <motion.div className="flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.button
            onClick={handleSave}
            className={`px-6 py-3 rounded-xl text-white flex items-center gap-2 ${saved ? "bg-emerald-600" : "bg-slate-800 dark:bg-violet-600"}`}
            style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.2)", fontSize: "0.875rem" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            <span>{saved ? t("تم الحفظ!", "Saved!") : t("حفظ الإعدادات", "Save Settings")}</span>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

function ToggleSwitch({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.8125rem" }}>{label}</p>
        <p className="text-slate-400 dark:text-slate-500" style={{ fontSize: "0.6875rem" }}>{desc}</p>
      </div>
      <motion.button
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 transition-colors duration-300 rounded-full ${
          checked
            ? "bg-emerald-500 dark:bg-emerald-600"
            : "bg-slate-300 dark:bg-slate-600"
        }`}
        style={{
          width: 50,
          height: 28,
          boxShadow: checked
            ? "inset 0 1px 1px rgba(0,0,0,0.06), 0 0 0 1px rgba(16,185,129,0.12)"
            : "inset 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
        whileTap={{ scale: 0.93 }}
        role="switch"
        aria-checked={checked}
      >
        <motion.div
          className="absolute top-[3px] rounded-full bg-white flex items-center justify-center"
          style={{
            width: 22,
            height: 22,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
          }}
          animate={{ x: checked ? 25 : 3 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        >
          <AnimatePresence mode="wait">
            {checked ? (
              <motion.svg
                key="check"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            ) : (
              <motion.svg
                key="x"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <path d="M3 3L7 7M7 3L3 7" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              </motion.svg>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.button>
    </div>
  );
}