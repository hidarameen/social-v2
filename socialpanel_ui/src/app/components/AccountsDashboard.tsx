import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Shield,
  Zap,
  Globe,
  Activity,
  TrendingUp,
  Link2,
  X,
  ArrowUpDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { AnimatedBackground } from "./AnimatedBackground";
import { AccountCard, type ConnectedAccount } from "./AccountCard";
import { PlatformSelector } from "./PlatformSelector";
import { ConnectModal, type ConnectPayload } from "./ConnectModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import {
  platforms,
  type PlatformInfo,
} from "./PlatformIcons";
import { apiRequest } from "../services/api";
import { useTheme } from "../context/ThemeContext";

type SortMode = "newest" | "name" | "followers";
const ACCOUNTS_CACHE_KEY = "socialflow_accounts_cache_v1";

function trimInput(value: unknown): string {
  return String(value || "").trim();
}

function mapApiAccount(account: any, language: "ar" | "en"): ConnectedAccount {
  const platform = platforms.find((p) => p.id === account.platformId) || platforms[0];
  const username = String(account.accountUsername || account.accountName || account.accountId || "Account");
  return {
    id: String(account.id),
    platform,
    username,
    connectedAt: account.createdAt ? new Date(account.createdAt).toLocaleDateString(language) : "",
    status: account.isActive ? "active" : "expired",
    postsCount: 0,
    followers: "0",
  };
}

export function AccountsDashboard() {
  const { language, t } = useTheme();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.sessionStorage.getItem(ACCOUNTS_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ConnectedAccount[];
    } catch {
      return [];
    }
  });
  const [accountsLoading, setAccountsLoading] = useState<boolean>(accounts.length === 0);
  const [showPlatformSelector, setShowPlatformSelector] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformInfo | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConnectedAccount | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      try {
        if (accounts.length === 0) {
          setAccountsLoading(true);
        }
        const payload = await apiRequest<any>("/api/accounts?limit=200&offset=0&sortBy=createdAt&sortDir=desc");
        if (!active) return;
        const mapped = ((payload.accounts || []) as any[]).map((account) => mapApiAccount(account, language));
        setAccounts(mapped);
      } catch {
        if (active) setAccounts([]);
      } finally {
        if (active) {
          setAccountsLoading(false);
        }
      }
    }
    void loadAccounts();
    return () => {
      active = false;
    };
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(ACCOUNTS_CACHE_KEY, JSON.stringify(accounts));
    } catch {
      // no-op when storage is unavailable
    }
  }, [accounts]);

  // Scroll to top detector
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const connectedPlatformIds = useMemo(
    () => accounts.map((a) => a.platform.id),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    let result = accounts.filter((acc) => {
      const matchesSearch =
        acc.platform.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        filterStatus === "all" || acc.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

    // Sort
    if (sortMode === "name") {
      result = [...result].sort((a, b) => a.platform.name.localeCompare(b.platform.name));
    } else if (sortMode === "followers") {
      const parseFollowers = (f: string) => {
        const num = parseFloat(f.replace("K", "").replace("M", ""));
        if (f.includes("M")) return num * 1000000;
        if (f.includes("K")) return num * 1000;
        return num;
      };
      result = [...result].sort((a, b) => parseFollowers(b.followers) - parseFollowers(a.followers));
    }

    return result;
  }, [accounts, searchQuery, filterStatus, sortMode]);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((a) => a.status === "active").length,
      expired: accounts.filter((a) => a.status === "expired").length,
      totalPosts: accounts.reduce((sum, a) => sum + a.postsCount, 0),
    }),
    [accounts]
  );

  const handlePlatformSelect = (platform: PlatformInfo) => {
    setSelectedPlatform(platform);
    setShowPlatformSelector(false);
    setTimeout(() => setShowConnectModal(true), 200);
  };

  const handleConnect = async (platform: PlatformInfo, payload: ConnectPayload) => {
    if (platform.id !== "telegram") {
      try {
        if (payload.platformCredentialPayload && Object.keys(payload.platformCredentialPayload).length > 0) {
          await apiRequest("/api/platform-credentials", {
            method: "PUT",
            body: {
              platformId: platform.id,
              credentials: payload.platformCredentialPayload,
            },
          });
        }

        const returnTo = "/index.html#/dashboard/accounts";
        const startPayload = await apiRequest<{ success: boolean; url?: string; authUrl?: string }>(
          `/api/oauth/${platform.id}/start?returnTo=${encodeURIComponent(returnTo)}&mode=json`
        );
        const authUrl = trimInput(startPayload?.url || startPayload?.authUrl);
        if (!authUrl) {
          throw new Error("تعذر بدء الربط. تحقق من إعدادات API/OAuth لهذه المنصة.");
        }

        window.location.assign(authUrl);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذر بدء عملية ربط الحساب";
        toast.error(message);
        throw new Error(message);
      }
    }

    const normalizedName = trimInput(payload.accountName);
    if (!normalizedName) {
      toast.error("يرجى إدخال اسم الحساب");
      throw new Error("يرجى إدخال اسم الحساب");
    }

    const accessToken = trimInput(payload.accessToken);
    const accountUsername = trimInput(payload.accountUsername) || normalizedName;
    const accountId = trimInput(payload.accountId);
    const credentials =
      payload.credentials && typeof payload.credentials === "object" ? payload.credentials : {};

    try {
      if (payload.platformCredentialPayload && Object.keys(payload.platformCredentialPayload).length > 0) {
        await apiRequest("/api/platform-credentials", {
          method: "PUT",
          body: {
            platformId: platform.id,
            credentials: payload.platformCredentialPayload,
          },
        });
      }

      const response = await apiRequest<any>("/api/accounts", {
        method: "POST",
        body: {
          platformId: platform.id,
          accountName: normalizedName,
          accountUsername,
          accountId: accountId || undefined,
          accessToken: accessToken || undefined,
          credentials,
          isActive: true,
        },
      });

      const account = mapApiAccount(response.account || {}, language);
      setAccounts((prev) => {
        const next = prev.filter((item) => item.id !== account.id);
        return [account, ...next];
      });
      setShowConnectModal(false);
      toast.success(`تم ربط حساب ${platform.name} بنجاح`, {
        style: {
          background: "#fff",
          border: "1px solid rgba(16,185,129,0.3)",
          color: "#1e293b",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر ربط الحساب";
      toast.error(message);
      throw new Error(message);
    }
  };

  const handleDelete = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (acc) setDeleteTarget(acc);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      void apiRequest(`/api/accounts/${deleteTarget.id}`, { method: "DELETE" })
        .then(() => {
          setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
          toast.error(`تم حذف حساب ${deleteTarget.platform.name}`, {
            style: {
              background: "#fff",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#1e293b",
              boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            },
          });
        })
        .catch(() => {
          toast.error("تعذر حذف الحساب");
        });
      setDeleteTarget(null);
    }
  };

  const handleRefresh = (id: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "refreshing" as const } : a))
    );
    void apiRequest(`/api/accounts/${id}`, {
      method: "PATCH",
      body: { isActive: true },
    })
      .then(() => {
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "active" as const } : a))
        );
        toast.success("تم تحديث الربط بنجاح", {
          style: {
            background: "#fff",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#1e293b",
            boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          },
        });
      })
      .catch(() => {
        setAccounts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: "expired" as const } : a))
        );
        toast.error("تعذر تحديث حالة الحساب");
      });
  };

  return (
    <div
      className="w-full relative"
      style={{
        fontFamily: language === "ar" ? "Cairo, Inter, sans-serif" : "Inter, sans-serif",
      }}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Hero Header */}
      <motion.div
        className="mb-6 sm:mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <motion.div
              className="flex items-center gap-2 mb-3 flex-wrap"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="px-3 py-1 rounded-full bg-white border border-purple-200" style={{ boxShadow: "0 2px 8px rgba(139,92,246,0.1)" }}>
                <span className="text-purple-700" style={{ fontSize: "0.75rem" }}>
                  {t("لوحة الحسابات", "Accounts Panel")}
                </span>
              </div>
              <div className="px-3 py-1 rounded-full bg-white border border-emerald-200 flex items-center gap-1.5" style={{ boxShadow: "0 2px 8px rgba(16,185,129,0.1)" }}>
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-emerald-700" style={{ fontSize: "0.75rem" }}>
                  {t(`${stats.active} حسابات نشطة`, `${stats.active} active accounts`)}
                </span>
              </div>
              {stats.expired > 0 && (
                <div className="px-3 py-1 rounded-full bg-white border border-amber-200 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-amber-700" style={{ fontSize: "0.75rem" }}>
                    {t(`${stats.expired} تحتاج تحديث`, `${stats.expired} need refresh`)}
                  </span>
                </div>
              )}
            </motion.div>

            <motion.h1
              className="text-slate-800 mb-1"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {t("إدارة الحسابات", "Accounts Management")}
            </motion.h1>
            <motion.p
              className="text-slate-500"
              style={{ fontSize: "0.875rem" }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              {t(
                "ربط وإدارة حسابات التواصل الاجتماعي عبر OAuth للنشر التلقائي",
                "Connect and manage social accounts via OAuth for automation"
              )}
            </motion.p>
          </div>

          <motion.button
            onClick={() => setShowPlatformSelector(true)}
            className="px-5 sm:px-6 py-3 rounded-2xl bg-slate-800 text-white flex items-center gap-2 relative overflow-hidden group shrink-0"
            style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
            whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(15,23,42,0.35)" }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Plus className="w-5 h-5" />
            <span>{t("إضافة حساب", "Add Account")}</span>
            <motion.div
              className="absolute inset-0 bg-white/10"
              initial={{ x: "-100%" }}
              whileHover={{ x: "100%" }}
              transition={{ duration: 0.5 }}
            />
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {[
          {
            icon: Globe,
            label: t("إجمالي الحسابات", "Total Accounts"),
            value: stats.total,
            iconBg: "bg-violet-100",
            iconColor: "text-violet-600",
          },
          {
            icon: Activity,
            label: t("حسابات نشطة", "Active Accounts"),
            value: stats.active,
            iconBg: "bg-emerald-100",
            iconColor: "text-emerald-600",
          },
          {
            icon: TrendingUp,
            label: t("إجمالي المنشورات", "Total Posts"),
            value: stats.totalPosts,
            iconBg: "bg-blue-100",
            iconColor: "text-blue-600",
          },
          {
            icon: Link2,
            label: t("تنتظر تحديث", "Need Refresh"),
            value: stats.expired,
            iconBg: "bg-amber-100",
            iconColor: "text-amber-600",
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            className="relative rounded-2xl p-4 bg-white"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            whileHover={{ scale: 1.02, y: -2, boxShadow: "0 8px 25px rgba(0,0,0,0.08)" }}
          >
            <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <p className="text-slate-800" style={{ fontSize: "1.5rem", fontFamily: "Space Grotesk, sans-serif" }}>
              {stat.value}
            </p>
            <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>
              {stat.label}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <motion.div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5 sm:mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("ابحث عن حساب...", "Search account...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pr-10 pl-10 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            style={{ fontSize: "0.875rem", boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Tabs */}
          <div
            className="flex items-center rounded-xl bg-white overflow-hidden"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}
          >
            {[
              { id: "all", label: t("الكل", "All"), count: accounts.length },
              { id: "active", label: t("نشط", "Active"), count: stats.active },
              { id: "expired", label: t("منتهي", "Expired"), count: stats.expired },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className={`px-3 sm:px-4 py-2.5 transition-all flex items-center gap-1 ${
                  filterStatus === f.id
                    ? "bg-slate-800 text-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
                style={{
                  fontSize: "0.8125rem",
                  borderRadius: filterStatus === f.id ? "0.65rem" : "0",
                }}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      filterStatus === f.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                    style={{ fontSize: "0.625rem" }}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div
            className="flex items-center rounded-xl bg-white overflow-hidden"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}
          >
            <button
              onClick={() => {
                const modes: SortMode[] = ["newest", "name", "followers"];
                const idx = modes.indexOf(sortMode);
                setSortMode(modes[(idx + 1) % modes.length]);
              }}
              className="px-3 py-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1"
              style={{ fontSize: "0.8125rem" }}
              title={t("ترتيب", "Sort")}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {sortMode === "newest" ? t("الأحدث", "Newest") : sortMode === "name" ? t("الاسم", "Name") : t("المتابعين", "Followers")}
              </span>
            </button>
          </div>

          {/* View Mode */}
          <div
            className="flex items-center rounded-xl bg-white overflow-hidden"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 transition-all ${
                viewMode === "grid"
                  ? "bg-slate-800 text-white rounded-xl"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2.5 transition-all ${
                viewMode === "list"
                  ? "bg-slate-800 text-white rounded-xl"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Results count */}
      {searchQuery && (
        <motion.p
          className="text-slate-500 mb-4"
          style={{ fontSize: "0.8125rem" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {t(`${filteredAccounts.length} نتيجة لـ "${searchQuery}"`, `${filteredAccounts.length} results for "${searchQuery}"`)}
        </motion.p>
      )}

      {/* Accounts Grid/List */}
      <AnimatePresence mode="popLayout">
        {accountsLoading && accounts.length === 0 ? (
          <motion.div
            className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm p-8 sm:p-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-center gap-3 text-slate-600 dark:text-slate-300">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span style={{ fontSize: "0.9rem" }}>
                {t("جاري تحميل الحسابات...", "Loading accounts...")}
              </span>
            </div>
          </motion.div>
        ) : filteredAccounts.length > 0 ? (
          <motion.div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
                : "flex flex-col gap-3"
            }
            layout
          >
            {filteredAccounts.map((account, i) => (
              <AccountCard
                key={account.id}
                account={account}
                index={i}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
                viewMode={viewMode}
              />
            ))}

            {/* Add More Card - only in grid mode */}
            {viewMode === "grid" && (
              <motion.button
                onClick={() => setShowPlatformSelector(true)}
                className="relative rounded-2xl min-h-[200px] group bg-white/50 backdrop-blur-sm transition-all"
                style={{
                  border: "2px dashed rgba(0,0,0,0.1)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + filteredAccounts.length * 0.08 }}
                whileHover={{
                  borderColor: "rgba(139,92,246,0.4)",
                  background: "rgba(255,255,255,0.8)",
                  boxShadow: "0 8px 30px rgba(139,92,246,0.1)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <motion.div
                    className="w-14 h-14 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center mb-4"
                    whileHover={{
                      scale: 1.1,
                      boxShadow: "0 0 30px rgba(139,92,246,0.2)",
                    }}
                  >
                    <Plus className="w-7 h-7 text-violet-600" />
                  </motion.div>
                  <p className="text-slate-600" style={{ fontSize: "0.875rem" }}>
                    {t("إضافة حساب جديد", "Add New Account")}
                  </p>
                  <p className="text-slate-400 mt-1" style={{ fontSize: "0.75rem" }}>
                    {t("12 منصة متاحة للربط", "12 platforms available")}
                  </p>
                </div>
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="text-center py-16 sm:py-20 rounded-3xl bg-white/70 backdrop-blur-sm"
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139,92,246,0.08)",
                  "0 0 40px rgba(139,92,246,0.15)",
                  "0 0 20px rgba(139,92,246,0.08)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Globe className="w-10 h-10 text-violet-500" />
            </motion.div>
            <h3 className="text-slate-700 mb-2">{t("لا توجد حسابات", "No accounts found")}</h3>
            <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem" }}>
              {searchQuery
                ? t(`لم يتم العثور على نتائج لـ "${searchQuery}"`, `No results for "${searchQuery}"`)
                : t("ابدأ بربط حسابات التواصل الاجتماعي", "Start by connecting your social accounts")}
            </p>
            {searchQuery ? (
              <motion.button
                onClick={() => setSearchQuery("")}
                className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 inline-flex items-center gap-2 hover:bg-slate-200 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <X className="w-4 h-4" />
                {t("مسح البحث", "Clear Search")}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setShowPlatformSelector(true)}
                className="px-6 py-3 rounded-2xl bg-slate-800 text-white inline-flex items-center gap-2"
                style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-5 h-5" />
                {t("إضافة أول حساب", "Add First Account")}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add button for list mode */}
      {viewMode === "list" && filteredAccounts.length > 0 && (
        <motion.button
          onClick={() => setShowPlatformSelector(true)}
          className="w-full mt-4 py-3 rounded-2xl bg-white/60 border-2 border-dashed border-slate-200 text-slate-500 hover:bg-white hover:border-violet-300 hover:text-violet-600 transition-all flex items-center justify-center gap-2"
          whileHover={{ boxShadow: "0 4px 16px rgba(139,92,246,0.08)" }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="w-4 h-4" />
          <span style={{ fontSize: "0.875rem" }}>{t("إضافة حساب جديد", "Add New Account")}</span>
        </motion.button>
      )}

      {/* Bottom Security Badge */}
      <motion.div
        className="mt-10 sm:mt-12 text-center pb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <div
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/70 backdrop-blur-sm"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 6px rgba(0,0,0,0.03)",
          }}
        >
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-slate-500" style={{ fontSize: "0.75rem" }}>
            {t("جميع الاتصالات مشفرة ومؤمنة عبر بروتوكول OAuth 2.0", "All connections are encrypted and secured via OAuth 2.0")}
          </span>
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
      </motion.div>

      {/* Modals */}
      <PlatformSelector
        isOpen={showPlatformSelector}
        onClose={() => setShowPlatformSelector(false)}
        onSelect={handlePlatformSelect}
        connectedPlatforms={connectedPlatformIds}
      />

      <ConnectModal
        platform={selectedPlatform}
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnect}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        accountName={deleteTarget?.username || ""}
        platformId={deleteTarget?.platform.id || "facebook"}
        platformName={deleteTarget?.platform.name || ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
