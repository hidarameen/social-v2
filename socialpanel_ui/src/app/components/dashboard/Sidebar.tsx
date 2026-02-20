import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Zap,
  Activity,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, language, t } = useTheme();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const navItems = [
    { id: "dashboard", path: "/dashboard", icon: LayoutDashboard, label: t("الرئيسية", "Home") },
    { id: "accounts", path: "/dashboard/accounts", icon: Users, label: t("الحسابات", "Accounts") },
    { id: "tasks", path: "/dashboard/tasks", icon: Zap, label: t("المهام", "Tasks") },
    { id: "executions", path: "/dashboard/executions", icon: Activity, label: t("التنفيذات", "Executions") },
    { id: "analytics", path: "/dashboard/analytics", icon: BarChart3, label: t("التحليلات", "Analytics") },
  ];

  const bottomItems = [
    { id: "settings", path: "/dashboard/settings", icon: Settings, label: t("الإعدادات", "Settings") },
    { id: "help", path: "/dashboard/help", icon: HelpCircle, label: t("المساعدة", "Help") },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(path);
  };

  const handleNav = (path: string) => {
    navigate(path);
    onMobileClose();
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 shrink-0">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            boxShadow: "0 4px 15px rgba(139,92,246,0.25)",
          }}
          whileHover={{ scale: 1.05, rotate: 5 }}
        >
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
            }}
            animate={{ x: ["-200%", "200%"] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          />
          <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L38 14V30L24 38L10 30V14L24 6Z" stroke="white" strokeWidth="2.5" fill="none" />
            <path d="M24 14L31 18V26L24 30L17 26V18L24 14Z" fill="white" fillOpacity="0.9" />
          </svg>
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="text-slate-800 dark:text-slate-200 whitespace-nowrap"
              style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "1.125rem" }}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              SocialHub
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Pro Badge */}
      {!collapsed && (
        <motion.div
          className="mx-4 mb-4 p-3 rounded-xl"
          style={{
            background: theme === "dark"
              ? "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))"
              : "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.06))",
            border: theme === "dark"
              ? "1px solid rgba(139,92,246,0.2)"
              : "1px solid rgba(139,92,246,0.12)",
          }}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-violet-700 dark:text-violet-300" style={{ fontSize: "0.8125rem" }}>{t("خطة Pro", "Pro Plan")}</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: "0.6875rem" }}>{t("12 حساب من 50 مستخدم", "12 of 50 accounts")}</p>
          <div className="mt-2 h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: "24%" }}
              transition={{ delay: 0.5, duration: 0.8 }}
            />
          </div>
        </motion.div>
      )}

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item, idx) => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNav(item.path)}
              onHoverStart={() => setHoveredItem(item.id)}
              onHoverEnd={() => setHoveredItem(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
                active
                  ? "bg-slate-800 dark:bg-violet-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              }`}
              style={{ fontSize: "0.875rem" }}
              whileHover={{ x: collapsed ? 0 : (language === "ar" ? -2 : 2) }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: language === "ar" ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Active indicator */}
              {active && (
                <motion.div
                  className={`absolute ${language === "ar" ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-violet-400`}
                  layoutId="activeIndicator"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              {collapsed && hoveredItem === item.id && (
                <motion.div
                  className={`absolute ${language === "ar" ? "right-full mr-2" : "left-full ml-2"} px-2.5 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white whitespace-nowrap`}
                  style={{ fontSize: "0.75rem", zIndex: 100, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
                  initial={{ opacity: 0, x: language === "ar" ? 5 : -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: language === "ar" ? 5 : -5 }}
                >
                  {item.label}
                </motion.div>
              )}
            </motion.button>
          );
        })}

        <div className="my-3 border-t border-slate-100 dark:border-slate-700/50" />

        {bottomItems.map((item) => {
          const active = isActive(item.path);
          return (
            <motion.button
              key={item.id}
              onClick={() => handleNav(item.path)}
              onHoverStart={() => setHoveredItem(item.id)}
              onHoverEnd={() => setHoveredItem(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative ${
                active ? "bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/30 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              style={{ fontSize: "0.8125rem" }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative shrink-0">
                <item.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-slate-100 dark:border-slate-700/50 shrink-0">
        {!collapsed && user && (
          <motion.div
            className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleNav("/dashboard/settings")}
          >
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-600" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <span className="text-violet-600 dark:text-violet-400" style={{ fontSize: "0.8125rem" }}>{user.name.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 dark:text-slate-300 truncate" style={{ fontSize: "0.8125rem" }}>{user.name}</p>
              <p className="text-slate-400 truncate" style={{ fontSize: "0.6875rem" }}>{user.email}</p>
            </div>
          </motion.div>
        )}

        <motion.button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          style={{ fontSize: "0.8125rem" }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {t("تسجيل الخروج", "Sign Out")}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:flex px-3 pb-3 shrink-0">
        <motion.button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
            {language === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </motion.div>
        </motion.button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm lg:hidden"
            style={{ zIndex: 40 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            className={`fixed top-0 ${language === "ar" ? "right-0" : "left-0"} h-full w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg lg:hidden`}
            style={{
              zIndex: 50,
              boxShadow: language === "ar" ? "-4px 0 30px rgba(0,0,0,0.1)" : "4px 0 30px rgba(0,0,0,0.1)",
              borderLeft: language === "ar" ? "1px solid rgba(0,0,0,0.06)" : "none",
              borderRight: language === "ar" ? "none" : "1px solid rgba(0,0,0,0.06)",
            }}
            initial={{ x: language === "ar" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        className="hidden lg:flex flex-col h-screen sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shrink-0"
        style={{
          borderLeft: language === "ar" ? (theme === "dark" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)") : "none",
          borderRight: language === "ar" ? "none" : (theme === "dark" ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)"),
          boxShadow: language === "ar" ? "-1px 0 10px rgba(0,0,0,0.03)" : "1px 0 10px rgba(0,0,0,0.03)",
        }}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
