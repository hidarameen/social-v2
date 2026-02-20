import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus, Search, X, Play, Pause, Trash2, Edit3, MoreHorizontal,
  Zap, ArrowLeft, Filter, Clock, CheckCircle2, XCircle, AlertTriangle,
  Activity, ChevronDown, Eye, Copy,
} from "lucide-react";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { platformAutomation } from "./PlatformAutomation";
import { TaskCreator, type AutomationTask } from "./TaskCreator";
import { apiRequest } from "../../services/api";

const mockTasks: AutomationTask[] = [
  {
    id: "task_1",
    name: "نشر تلقائي من Instagram إلى Facebook و X",
    description: "عند نشر منشور جديد على Instagram يتم نشره تلقائياً على Facebook وX",
    enabled: true,
    sources: [{ platformId: "instagram", accountLabel: "@design_pro", triggerId: "ig_new_post" }],
    targets: [
      { platformId: "facebook", accountLabel: "Creative Studio", actionId: "fb_create_post" },
      { platformId: "twitter", accountLabel: "@tech_news", actionId: "tw_create_tweet" },
    ],
    createdAt: "2026-02-15",
    lastRun: "2026-02-20 14:30",
    runCount: 47,
    status: "active",
  },
  {
    id: "task_2",
    name: "تحويل رسائل Telegram إلى WhatsApp",
    description: "تحويل الرسائل الجديدة من بوت Telegram إلى WhatsApp Business",
    enabled: true,
    sources: [{ platformId: "telegram", accountLabel: "@channel_bot", triggerId: "tg_new_message" }],
    targets: [{ platformId: "whatsapp", accountLabel: "+966 50 XXX", actionId: "wa_send_message" }],
    createdAt: "2026-02-10",
    lastRun: "2026-02-20 15:12",
    runCount: 123,
    status: "active",
  },
  {
    id: "task_3",
    name: "إشعار YouTube على جميع المنصات",
    description: "عند رفع فيديو جديد على YouTube يتم الإعلان عنه على جميع المنصات",
    enabled: false,
    sources: [{ platformId: "youtube", accountLabel: "Channel Pro", triggerId: "yt_new_video" }],
    targets: [
      { platformId: "facebook", accountLabel: "Creative Studio", actionId: "fb_create_post" },
      { platformId: "instagram", accountLabel: "@design_pro", actionId: "ig_create_post" },
      { platformId: "twitter", accountLabel: "@tech_news", actionId: "tw_create_tweet" },
      { platformId: "linkedin", accountLabel: "Company Profile", actionId: "li_create_post" },
      { platformId: "telegram", accountLabel: "@channel_bot", actionId: "tg_send_message" },
    ],
    createdAt: "2026-01-20",
    lastRun: "2026-02-18 09:45",
    runCount: 12,
    status: "paused",
  },
];

type FilterType = "all" | "active" | "paused" | "error";

export function TasksPage() {
  const [tasks, setTasks] = useState<AutomationTask[]>(mockTasks);
  const [showCreator, setShowCreator] = useState(false);
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadTasks() {
      try {
        const payload = await apiRequest<any>("/api/tasks?limit=200&offset=0&sortBy=createdAt&sortDir=desc");
        if (!active) return;
        const accountsById = (payload.accountsById || {}) as Record<string, any>;
        const mapped = ((payload.tasks || []) as any[]).map((task) => {
          const sourceAccounts = Array.isArray(task.sourceAccounts) ? task.sourceAccounts : [];
          const targetAccounts = Array.isArray(task.targetAccounts) ? task.targetAccounts : [];
          const sources = sourceAccounts.map((id: string) => {
            const account = accountsById[id] || {};
            return {
              platformId: (account.platformId || "twitter") as PlatformType,
              accountLabel: String(account.accountName || account.accountUsername || id),
              triggerId: "trigger",
            };
          });
          const targets = targetAccounts.map((id: string) => {
            const account = accountsById[id] || {};
            return {
              platformId: (account.platformId || "facebook") as PlatformType,
              accountLabel: String(account.accountName || account.accountUsername || id),
              actionId: "action",
            };
          });
          return {
            id: String(task.id),
            name: String(task.name || "Task"),
            description: String(task.description || ""),
            enabled: task.status === "active",
            sources,
            targets,
            createdAt: task.createdAt
              ? new Date(task.createdAt).toISOString().slice(0, 10)
              : "2026-01-01",
            lastRun: task.lastExecuted ? new Date(task.lastExecuted).toLocaleString("ar") : undefined,
            runCount: Number(task.executionCount || 0),
            status: (String(task.status || "paused") as "active" | "paused" | "error"),
          } satisfies AutomationTask;
        });
        if (mapped.length > 0) {
          setTasks(mapped);
        }
      } catch {
        // Keep demo fallback when API request fails.
      }
    }
    void loadTasks();
    return () => {
      active = false;
    };
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.name.includes(searchQuery) || t.description.includes(searchQuery);
      const matchFilter = filter === "all" || t.status === filter || (filter === "paused" && !t.enabled);
      return matchSearch && matchFilter;
    });
  }, [tasks, searchQuery, filter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    active: tasks.filter((t) => t.enabled && t.status === "active").length,
    paused: tasks.filter((t) => !t.enabled || t.status === "paused").length,
    totalRuns: tasks.reduce((s, t) => s + t.runCount, 0),
  }), [tasks]);

  const toggleTask = (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const nextStatus = current.enabled ? "paused" : "active";
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, enabled: !t.enabled, status: nextStatus } : t));
    void apiRequest(`/api/tasks/${id}`, {
      method: "PATCH",
      body: { status: nextStatus },
    }).catch(() => {
      setTasks((prev) => prev.map((t) => t.id === id ? current : t));
    });
  };

  const deleteTask = (id: string) => {
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    void apiRequest(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => {
      setTasks(previous);
    });
  };

  const duplicateTask = (task: AutomationTask) => {
    const dup = { ...task, id: `task_${Date.now()}`, name: `${task.name} (نسخة)`, runCount: 0, lastRun: undefined };
    setTasks((prev) => [...prev, dup]);
    void apiRequest("/api/tasks", {
      method: "POST",
      body: {
        name: dup.name,
        description: dup.description,
        sourceAccounts: [],
        targetAccounts: [],
        status: "paused",
      },
    }).catch(() => {
      // Ignore sync failure in optimistic duplicate flow.
    });
  };

  const handleSave = (task: AutomationTask) => {
    if (editingTask) setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    else setTasks((prev) => [...prev, task]);
    setShowCreator(false);
    setEditingTask(null);

    const payload = {
      name: task.name,
      description: task.description,
      sourceAccounts: [],
      targetAccounts: [],
      status: task.enabled ? "active" : "paused",
    };
    if (editingTask) {
      void apiRequest(`/api/tasks/${task.id}`, { method: "PATCH", body: payload }).catch(() => {
        // Keep local state when sync fails.
      });
    } else {
      void apiRequest("/api/tasks", { method: "POST", body: payload }).catch(() => {
        // Keep local state when sync fails.
      });
    }
  };

  const getTriggerLabel = (platformId: PlatformType, triggerId: string) => {
    return platformAutomation[platformId]?.triggers.find((t) => t.id === triggerId)?.label || triggerId;
  };

  const getActionLabel = (platformId: PlatformType, actionId: string) => {
    return platformAutomation[platformId]?.actions.find((a) => a.id === actionId)?.label || actionId;
  };

  if (showCreator || editingTask) {
    return (
      <TaskCreator
        task={editingTask || undefined}
        onSave={handleSave}
        onCancel={() => { setShowCreator(false); setEditingTask(null); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="px-3 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(139,92,246,0.15)", boxShadow: "0 2px 8px rgba(139,92,246,0.06)" }}>
              <span className="text-violet-700" style={{ fontSize: "0.75rem" }}>مهام الأتمتة</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-white flex items-center gap-1.5" style={{ border: "1px solid rgba(16,185,129,0.15)" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-emerald-500" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
              <span className="text-emerald-700" style={{ fontSize: "0.75rem" }}>{stats.active} نشطة</span>
            </div>
          </div>
          <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>مهام الربط التلقائي</h2>
          <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>أنشئ مهام أتمتة لربط حساباتك وتحويل المحتوى تلقائياً</p>
        </div>
        <motion.button
          onClick={() => setShowCreator(true)}
          className="px-5 py-3 rounded-2xl bg-slate-800 text-white flex items-center gap-2 shrink-0"
          style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-5 h-5" />
          <span>إنشاء مهمة</span>
        </motion.button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Zap, label: "إجمالي المهام", value: stats.total, color: "text-violet-600", bg: "bg-violet-50" },
          { icon: Play, label: "مهام نشطة", value: stats.active, color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Pause, label: "متوقفة", value: stats.paused, color: "text-amber-600", bg: "bg-amber-50" },
          { icon: Activity, label: "إجمالي التنفيذات", value: stats.totalRuns, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((s, i) => (
          <motion.div key={i} className="p-4 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ scale: 1.02, y: -2 }}>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <p className="text-slate-800" style={{ fontSize: "1.5rem", fontFamily: "Space Grotesk, sans-serif" }}>{s.value}</p>
            <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <motion.div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="ابحث عن مهمة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pr-10 pl-10 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" style={{ fontSize: "0.875rem" }} />
          {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
        </div>
        <div className="flex items-center rounded-xl bg-white overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          {(["all", "active", "paused"] as FilterType[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2.5 transition-all ${filter === f ? "bg-slate-800 text-white rounded-xl" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`} style={{ fontSize: "0.8125rem" }}>
              {f === "all" ? "الكل" : f === "active" ? "نشطة" : "متوقفة"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tasks List */}
      <AnimatePresence mode="popLayout">
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((task, i) => (
              <motion.div key={task.id} className="rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ delay: i * 0.05 }} layout>
                {/* Task Header */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {/* Toggle */}
                    <motion.button
                      onClick={() => toggleTask(task.id)}
                      className={`relative mt-1 shrink-0 rounded-full transition-colors duration-300 ${
                        task.enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                      }`}
                      style={{
                        width: 42,
                        height: 24,
                        boxShadow: task.enabled
                          ? "inset 0 1px 1px rgba(0,0,0,0.06), 0 0 0 1px rgba(16,185,129,0.12)"
                          : "inset 0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
                      }}
                      whileTap={{ scale: 0.9 }}
                      role="switch"
                      aria-checked={task.enabled}
                    >
                      <motion.div
                        className="absolute top-[2px] rounded-full bg-white"
                        style={{
                          width: 20,
                          height: 20,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)",
                        }}
                        animate={{ x: task.enabled ? 20 : 2 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </motion.button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-slate-800 truncate" style={{ fontSize: "0.9375rem" }}>{task.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full ${task.enabled ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`} style={{ fontSize: "0.6875rem" }}>
                          {task.enabled ? "نشطة" : "متوقفة"}
                        </span>
                      </div>
                      <p className="text-slate-500 mb-3" style={{ fontSize: "0.8125rem" }}>{task.description}</p>

                      {/* Flow visualization */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Sources */}
                        {task.sources.map((src, si) => (
                          <motion.div key={si} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50" style={{ border: "1px solid rgba(59,130,246,0.15)" }} whileHover={{ scale: 1.03 }}>
                            {getPlatformIcon(src.platformId, 16)}
                            <span className="text-blue-700" style={{ fontSize: "0.6875rem" }}>{getTriggerLabel(src.platformId, src.triggerId)}</span>
                          </motion.div>
                        ))}

                        {/* Arrow */}
                        <motion.div className="flex items-center" animate={task.enabled ? { x: [0, 4, 0] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowLeft className={`w-5 h-5 ${task.enabled ? "text-emerald-500" : "text-slate-300"}`} />
                        </motion.div>

                        {/* Targets */}
                        {task.targets.map((tgt, ti) => (
                          <motion.div key={ti} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50" style={{ border: "1px solid rgba(139,92,246,0.15)" }} whileHover={{ scale: 1.03 }}>
                            {getPlatformIcon(tgt.platformId, 16)}
                            <span className="text-violet-700" style={{ fontSize: "0.6875rem" }}>{getActionLabel(tgt.platformId, tgt.actionId)}</span>
                          </motion.div>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.6875rem" }}>
                          <Clock className="w-3 h-3" /> آخر تشغيل: {task.lastRun || "لم يشتغل بعد"}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.6875rem" }}>
                          <Activity className="w-3 h-3" /> {task.runCount} تنفيذ
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <motion.button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" whileTap={{ scale: 0.9 }}>
                        <Eye className="w-4 h-4 text-slate-400" />
                      </motion.button>
                      <div className="relative" ref={menuOpen === task.id ? menuRef : undefined}>
                        <motion.button onClick={() => setMenuOpen(menuOpen === task.id ? null : task.id)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" whileTap={{ scale: 0.9 }}>
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </motion.button>
                        <AnimatePresence>
                          {menuOpen === task.id && (
                            <motion.div className="absolute top-full mt-1 left-0 w-44 rounded-xl bg-white py-1" style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 12px 40px rgba(0,0,0,0.12)", zIndex: 50 }}
                              initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }}>
                              <button onClick={() => { setEditingTask(task); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 text-right" style={{ fontSize: "0.8125rem" }}>
                                <Edit3 className="w-3.5 h-3.5 text-blue-500" /><span>تعديل المهمة</span>
                              </button>
                              <button onClick={() => { duplicateTask(task); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 text-right" style={{ fontSize: "0.8125rem" }}>
                                <Copy className="w-3.5 h-3.5 text-violet-500" /><span>نسخ المهمة</span>
                              </button>
                              <button onClick={() => { toggleTask(task.id); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-600 hover:bg-slate-50 text-right" style={{ fontSize: "0.8125rem" }}>
                                {task.enabled ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-emerald-500" />}
                                <span>{task.enabled ? "إيقاف" : "تفعيل"}</span>
                              </button>
                              <div className="my-1 border-t border-slate-100" />
                              <button onClick={() => { deleteTask(task.id); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 text-right" style={{ fontSize: "0.8125rem" }}>
                                <Trash2 className="w-3.5 h-3.5" /><span>حذف</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expandedTask === task.id && (
                    <motion.div className="overflow-hidden" initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}>
                      <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-slate-700 mb-2 flex items-center gap-1.5" style={{ fontSize: "0.8125rem" }}>
                              <div className="w-2 h-2 rounded-full bg-blue-500" /> المصادر ({task.sources.length})
                            </h4>
                            {task.sources.map((src, si) => (
                              <div key={si} className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/50 mb-1.5" style={{ border: "1px solid rgba(59,130,246,0.1)" }}>
                                {getPlatformIcon(src.platformId, 20)}
                                <div>
                                  <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{platforms.find(p => p.id === src.platformId)?.name}</p>
                                  <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{src.accountLabel} • {getTriggerLabel(src.platformId, src.triggerId)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div>
                            <h4 className="text-slate-700 mb-2 flex items-center gap-1.5" style={{ fontSize: "0.8125rem" }}>
                              <div className="w-2 h-2 rounded-full bg-violet-500" /> الأهداف ({task.targets.length})
                            </h4>
                            {task.targets.map((tgt, ti) => (
                              <div key={ti} className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50/50 mb-1.5" style={{ border: "1px solid rgba(139,92,246,0.1)" }}>
                                {getPlatformIcon(tgt.platformId, 20)}
                                <div>
                                  <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{platforms.find(p => p.id === tgt.platformId)?.name}</p>
                                  <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{tgt.accountLabel} • {getActionLabel(tgt.platformId, tgt.actionId)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div className="text-center py-16 rounded-3xl bg-white/70" style={{ border: "1px solid rgba(0,0,0,0.06)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-violet-100 flex items-center justify-center" animate={{ boxShadow: ["0 0 20px rgba(139,92,246,0.08)", "0 0 40px rgba(139,92,246,0.15)", "0 0 20px rgba(139,92,246,0.08)"] }} transition={{ duration: 3, repeat: Infinity }}>
              <Zap className="w-10 h-10 text-violet-500" />
            </motion.div>
            <h3 className="text-slate-700 mb-2">لا توجد مهام</h3>
            <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem" }}>أنشئ أول مهمة أتمتة لربط حساباتك</p>
            <motion.button onClick={() => setShowCreator(true)} className="px-6 py-3 rounded-2xl bg-slate-800 text-white inline-flex items-center gap-2" style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Plus className="w-5 h-5" /> إنشاء أول مهمة
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
