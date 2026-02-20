import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Moon,
  Sun,
  X,
  Sparkles,
  Languages,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, language, toggleTheme, toggleLanguage, t } = useTheme();
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    "/dashboard": { title: t("الرئيسية", "Home"), subtitle: t("نظرة عامة على حساباتك وأدائك", "Overview of your accounts and performance") },
    "/dashboard/accounts": { title: t("إدارة الحسابات", "Accounts"), subtitle: t("ربط وإدارة حسابات التواصل الاجتماعي", "Connect & manage social accounts") },
    "/dashboard/tasks": { title: t("مهام الأتمتة", "Automation Tasks"), subtitle: t("إنشاء وإدارة مهام الربط التلقائي بين المنصات", "Create and manage automation tasks") },
    "/dashboard/manual-publish": {
      title: t("النشر اليدوي", "Manual Publish"),
      subtitle: t(
        "لوحة النشر اليدوي الكاملة لإدارة النشر المباشر والمجدول",
        "Full manual publishing workspace for instant and scheduled publishing"
      ),
    },
    "/dashboard/executions": { title: t("سجل التنفيذات", "Execution Log"), subtitle: t("تتبع جميع عمليات الأتمتة والتوجيهات", "Track all automation operations") },
    "/dashboard/analytics": { title: t("التحليلات", "Analytics"), subtitle: t("تتبع الأداء والإحصائيات التفصيلية", "Track performance and detailed statistics") },
    "/dashboard/settings": { title: t("الإعدادات", "Settings"), subtitle: t("تخصيص حسابك وتفضيلاتك", "Customize your account and preferences") },
    "/dashboard/help": { title: t("المساعدة", "Help"), subtitle: t("الدعم والأسئلة الشائعة", "Support and FAQ") },
  };

  const pageInfo = pageTitles[location.pathname] || pageTitles["/dashboard"];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = [
    { id: 1, text: t("تم نشر منشور على Instagram بنجاح", "Post published on Instagram successfully"), time: t("منذ 5 دقائق", "5 min ago"), read: false },
    { id: 2, text: t("حساب Facebook يحتاج تحديث الربط", "Facebook account needs reconnection"), time: t("منذ ساعة", "1 hour ago"), read: false },
    { id: 3, text: t("تقرير الأسبوع جاهز للمراجعة", "Weekly report ready for review"), time: t("منذ 3 ساعات", "3 hours ago"), read: true },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <motion.header
      className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg px-4 sm:px-6 py-3"
      style={{
        borderBottom: theme === "dark" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 8px rgba(0,0,0,0.03)",
        zIndex: 30,
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Right side */}
        <div className="flex items-center gap-3 min-w-0">
          <motion.button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            <Menu className="w-5 h-5" />
          </motion.button>

          <div className="min-w-0">
            <motion.h1
              className="text-slate-800 dark:text-slate-200 truncate"
              style={{ fontFamily: language === "ar" ? "Cairo, sans-serif" : "Inter, sans-serif", fontSize: "1.125rem", lineHeight: 1.3 }}
              key={pageInfo.title}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {pageInfo.title}
            </motion.h1>
            <motion.p
              className="text-slate-400 truncate hidden sm:block"
              style={{ fontSize: "0.75rem" }}
              key={pageInfo.subtitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {pageInfo.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Left side - actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Search toggle */}
          <AnimatePresence>
            {showSearch ? (
              <motion.div
                className="flex items-center gap-2"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
              >
                <div className="relative">
                  <Search className={`absolute ${language === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("بحث...", "Search...")}
                    className={`w-40 sm:w-56 py-2 ${language === "ar" ? "pr-9 pl-8" : "pl-9 pr-8"} rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all`}
                    style={{ fontSize: "0.8125rem" }}
                    autoFocus
                  />
                  <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className={`absolute ${language === "ar" ? "left-2" : "right-2"} top-1/2 -translate-y-1/2`}>
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                onClick={() => setShowSearch(true)}
                className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <Search className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Language Toggle */}
          <motion.button
            onClick={toggleLanguage}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors relative"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            title={language === "ar" ? "Switch to English" : "التبديل للعربية"}
          >
            <Languages className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
            <motion.span
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 flex items-center justify-center"
              style={{ fontSize: "0.5rem" }}
              key={language}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {language === "ar" ? "ع" : "En"}
            </motion.span>
          </motion.button>

          {/* Theme Toggle */}
          <motion.button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            title={theme === "dark" ? t("الوضع الفاتح", "Light Mode") : t("الوضع الداكن", "Dark Mode")}
          >
            <AnimatePresence mode="wait">
              {theme === "dark" ? (
                <motion.div key="sun" initial={{ rotate: -90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: 90, scale: 0 }} transition={{ duration: 0.2 }}>
                  <Sun className="w-4.5 h-4.5" style={{ width: 18, height: 18, color: "#f59e0b" }} />
                </motion.div>
              ) : (
                <motion.div key="moon" initial={{ rotate: 90, scale: 0 }} animate={{ rotate: 0, scale: 1 }} exit={{ rotate: -90, scale: 0 }} transition={{ duration: 0.2 }}>
                  <Moon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <motion.button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              whileTap={{ scale: 0.9 }}
            >
              <Bell className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              {notifications.some((n) => !n.read) && (
                <motion.span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  className={`absolute top-full mt-2 ${language === "ar" ? "left-0" : "right-0"} w-80 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden`}
                  style={{
                    border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
                    zIndex: 50,
                  }}
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-slate-800 dark:text-slate-200" style={{ fontSize: "0.875rem" }}>{t("الإشعارات", "Notifications")}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" style={{ fontSize: "0.6875rem" }}>
                      {notifications.filter((n) => !n.read).length} {t("جديد", "new")}
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notif, idx) => (
                      <motion.div
                        key={notif.id}
                        className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors border-b border-slate-50 dark:border-slate-700/50 ${!notif.read ? "bg-violet-50/30 dark:bg-violet-900/10" : ""}`}
                        initial={{ opacity: 0, x: language === "ar" ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className="flex items-start gap-2">
                          {!notif.read && <div className="w-2 h-2 mt-1.5 rounded-full bg-violet-500 shrink-0" />}
                          <div>
                            <p className="text-slate-700 dark:text-slate-300" style={{ fontSize: "0.8125rem" }}>{notif.text}</p>
                            <p className="text-slate-400 mt-0.5" style={{ fontSize: "0.6875rem" }}>{notif.time}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-100 dark:border-slate-700 text-center">
                    <button className="text-violet-600 dark:text-violet-400 hover:text-violet-700 transition-colors" style={{ fontSize: "0.8125rem" }}>
                      {t("عرض جميع الإشعارات", "View all notifications")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <motion.button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 p-1.5 pr-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-600" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <span className="text-violet-600 dark:text-violet-400" style={{ fontSize: "0.75rem" }}>{user?.name?.charAt(0)}</span>
                </div>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 hidden sm:block transition-transform ${showProfile ? "rotate-180" : ""}`} />
            </motion.button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  className={`absolute top-full mt-2 ${language === "ar" ? "left-0" : "right-0"} w-56 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden`}
                  style={{
                    border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
                    zIndex: 50,
                  }}
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-slate-800 dark:text-slate-200" style={{ fontSize: "0.875rem" }}>{user?.name}</p>
                    <p className="text-slate-400" style={{ fontSize: "0.75rem", direction: "ltr", textAlign: language === "ar" ? "right" : "left" }}>{user?.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30">
                      <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      <span className="text-violet-700 dark:text-violet-300" style={{ fontSize: "0.6875rem" }}>Pro</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { navigate("/dashboard/settings"); setShowProfile(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{t("الملف الشخصي", "Profile")}</span>
                    </button>
                    <button
                      onClick={() => { navigate("/dashboard/settings"); setShowProfile(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>{t("الإعدادات", "Settings")}</span>
                    </button>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-700 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      style={{ fontSize: "0.8125rem" }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{t("تسجيل الخروج", "Sign Out")}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
