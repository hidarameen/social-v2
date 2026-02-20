import { useState, useRef, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Users,
  BarChart3,
  ExternalLink,
  Eye,
} from "lucide-react";
import { getPlatformIcon, type PlatformType, type PlatformInfo } from "./PlatformIcons";

export interface ConnectedAccount {
  id: string;
  platform: PlatformInfo;
  username: string;
  avatar?: string;
  connectedAt: string;
  status: "active" | "expired" | "refreshing";
  postsCount: number;
  followers: string;
}

interface AccountCardProps {
  account: ConnectedAccount;
  index: number;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
  viewMode?: "grid" | "list";
}

export function AccountCard({
  account,
  index,
  onDelete,
  onRefresh,
  viewMode = "grid",
}: AccountCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const statusConfig = {
    active: {
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      label: "نشط",
      dot: "bg-emerald-500",
    },
    expired: {
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      label: "منتهي",
      dot: "bg-amber-500",
    },
    refreshing: {
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      label: "يتم التحديث",
      dot: "bg-blue-500",
    },
  };

  const status = statusConfig[account.status];

  const handleVisitProfile = () => {
    if (account.platform.profileUrl) {
      window.open(account.platform.profileUrl, "_blank");
    }
  };

  // List view layout
  if (viewMode === "list") {
    return (
      <motion.div
        className="relative group"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.4, delay: index * 0.06 }}
        layout
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => {
          setIsHovered(false);
          setShowMenu(false);
        }}
      >
        <motion.div
          className="relative rounded-2xl bg-white transition-all duration-300"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: isHovered
              ? "0 8px 30px rgba(0,0,0,0.08)"
              : "0 1px 6px rgba(0,0,0,0.03)",
          }}
          whileHover={{ y: -1 }}
        >
          <div className="flex items-center gap-4 p-4" dir="rtl">
            {/* Platform Icon + Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${account.platform.bgGlow}, transparent)`,
                  border: `1px solid ${account.platform.bgGlow}`,
                }}
              >
                {getPlatformIcon(account.platform.id, 26)}
              </div>
              {account.avatar && (
                <img
                  src={account.avatar}
                  alt=""
                  className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-white object-cover"
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-slate-800 truncate">{account.platform.name}</h4>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${status.bg} ${status.border} border`}>
                  <motion.div
                    className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                    animate={account.status === "active" ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className={status.color} style={{ fontSize: "0.6875rem" }}>{status.label}</span>
                </div>
              </div>
              <p className="text-slate-500 truncate" style={{ fontSize: "0.8125rem" }}>{account.username}</p>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-6 shrink-0">
              <div className="text-center">
                <p className="text-slate-700" style={{ fontSize: "0.875rem" }}>{account.postsCount}</p>
                <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>منشور</p>
              </div>
              <div className="text-center">
                <p className="text-slate-700" style={{ fontSize: "0.875rem" }}>{account.followers}</p>
                <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>متابع</p>
              </div>
              <div className="text-center">
                <p className="text-slate-700" style={{ fontSize: "0.875rem" }}>{account.connectedAt}</p>
                <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>تاريخ الربط</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <motion.button
                onClick={handleVisitProfile}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                whileTap={{ scale: 0.9 }}
                title="زيارة الحساب"
              >
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </motion.button>
              <div className="relative">
                <motion.button
                  ref={btnRef}
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                </motion.button>
                <AnimatePresence>
                  {showMenu && (
                    <DropdownMenu
                      ref={menuRef}
                      onRefresh={() => { onRefresh(account.id); setShowMenu(false); }}
                      onVisit={() => { handleVisitProfile(); setShowMenu(false); }}
                      onDelete={() => { onDelete(account.id); setShowMenu(false); }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // Grid view layout
  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, delay: index * 0.08, type: "spring" }}
      layout
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      <motion.div
        className="relative rounded-2xl bg-white transition-all duration-300"
        style={{
          border: isHovered ? "1px solid rgba(0,0,0,0.1)" : "1px solid rgba(0,0,0,0.06)",
          boxShadow: isHovered
            ? `0 16px 40px rgba(0,0,0,0.1), 0 4px 12px ${account.platform.bgGlow}`
            : "0 2px 12px rgba(0,0,0,0.04)",
        }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.3 }}
      >
        {/* Top gradient line */}
        <div
          className={`h-1 rounded-t-2xl bg-gradient-to-r ${account.platform.gradient}`}
          style={{ opacity: isHovered ? 1 : 0.7 }}
        />

        <div className="p-5">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-4" dir="rtl">
            {/* Left: Platform Icon + Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <motion.div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${account.platform.bgGlow}, rgba(248,250,252,0.8))`,
                    border: `1px solid ${account.platform.bgGlow}`,
                  }}
                  animate={{
                    boxShadow: isHovered
                      ? `0 4px 16px ${account.platform.bgGlow}`
                      : "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  {getPlatformIcon(account.platform.id, 26)}
                </motion.div>
                {/* Profile picture overlay */}
                {account.avatar && (
                  <img
                    src={account.avatar}
                    alt=""
                    className="absolute -bottom-1.5 -left-1.5 w-6 h-6 rounded-full border-2 border-white object-cover"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-slate-800 truncate">{account.platform.name}</h4>
                <p className="text-slate-500 truncate" style={{ fontSize: "0.8125rem" }}>
                  {account.username}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Visit profile button */}
              <motion.button
                onClick={handleVisitProfile}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                whileTap={{ scale: 0.9 }}
                title="زيارة الحساب"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </motion.button>

              {/* Menu button */}
              <div className="relative">
                <motion.button
                  ref={btnRef}
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  whileTap={{ scale: 0.9 }}
                >
                  <MoreHorizontal className="w-4 h-4 text-slate-500" />
                </motion.button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showMenu && (
                    <DropdownMenu
                      ref={menuRef}
                      onRefresh={() => { onRefresh(account.id); setShowMenu(false); }}
                      onVisit={() => { handleVisitProfile(); setShowMenu(false); }}
                      onDelete={() => { onDelete(account.id); setShowMenu(false); }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between mb-4" dir="rtl">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} ${status.border} border`}
            >
              <motion.div
                className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                animate={
                  account.status === "active"
                    ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }
                    : {}
                }
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className={status.color} style={{ fontSize: "0.75rem" }}>
                {status.label}
              </span>
            </div>

            {/* OAuth badge */}
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                OAuth 2.0
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4" dir="rtl">
            {[
              { icon: BarChart3, value: account.postsCount, label: "منشور", color: "text-blue-500" },
              { icon: Users, value: account.followers, label: "متابع", color: "text-violet-500" },
              { icon: Calendar, value: account.connectedAt, label: "تاريخ الربط", color: "text-emerald-500" },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center py-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
                style={{ border: "1px solid rgba(0,0,0,0.04)" }}
              >
                <stat.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>
                  {stat.value}
                </p>
                <p className="text-slate-400" style={{ fontSize: "0.625rem" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Connection Quality Bar */}
          <div className="flex items-center justify-between" dir="rtl">
            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
              جودة الاتصال
            </span>
            <div className="flex gap-0.5 items-end">
              {[1, 2, 3, 4, 5].map((bar) => (
                <motion.div
                  key={bar}
                  className={`w-1 rounded-full ${
                    bar <= (account.status === "active" ? 4 : account.status === "expired" ? 2 : 3)
                      ? account.status === "active" ? "bg-emerald-400" : account.status === "expired" ? "bg-amber-400" : "bg-blue-400"
                      : "bg-slate-200"
                  }`}
                  style={{ height: 4 + bar * 2 }}
                  animate={
                    isHovered
                      ? { height: [4 + bar * 2, 6 + bar * 2, 4 + bar * 2] }
                      : {}
                  }
                  transition={{
                    duration: 0.6,
                    delay: bar * 0.05,
                    repeat: isHovered ? Infinity : 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Extracted dropdown menu component

interface DropdownMenuProps {
  onRefresh: () => void;
  onVisit: () => void;
  onDelete: () => void;
}

const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ onRefresh, onVisit, onDelete }, ref) => {
    return (
      <motion.div
        ref={ref}
        className="absolute top-full mt-1 left-0 w-48 rounded-xl bg-white py-1"
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
          zIndex: 60,
        }}
        initial={{ opacity: 0, y: -4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <button
          onClick={onRefresh}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors text-right"
          dir="rtl"
          style={{ fontSize: "0.8125rem" }}
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
          <span>تحديث الربط</span>
        </button>
        <button
          onClick={onVisit}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors text-right"
          dir="rtl"
          style={{ fontSize: "0.8125rem" }}
        >
          <Eye className="w-3.5 h-3.5 text-violet-500" />
          <span>معاينة الحساب</span>
        </button>
        <button
          onClick={onVisit}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 transition-colors text-right"
          dir="rtl"
          style={{ fontSize: "0.8125rem" }}
        >
          <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
          <span>فتح الحساب</span>
        </button>
        <div className="my-1 border-t border-slate-100" />
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-right"
          dir="rtl"
          style={{ fontSize: "0.8125rem" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>حذف الحساب</span>
        </button>
      </motion.div>
    );
  }
);

DropdownMenu.displayName = "DropdownMenu";