import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, ArrowRight, Plus, X, Trash2, Zap, CheckCircle,
  ChevronDown, Sparkles, Shield, Save, Play, Eye,
} from "lucide-react";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { platformAutomation, type TriggerDef, type ActionDef } from "./PlatformAutomation";
import { apiRequest } from "../../services/api";

export interface TaskSource {
  platformId: PlatformType;
  accountId: string;
  accountLabel: string;
  triggerId: string;
}

export interface TaskTarget {
  platformId: PlatformType;
  accountId: string;
  accountLabel: string;
  actionId: string;
}

interface AccountOption {
  id: string;
  label: string;
}

function createEmptyAccountsByPlatform(): Record<PlatformType, AccountOption[]> {
  return Object.fromEntries(
    platforms.map((platform) => [platform.id, [] as AccountOption[]])
  ) as Record<PlatformType, AccountOption[]>;
}

export interface AutomationTask {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  sources: TaskSource[];
  targets: TaskTarget[];
  createdAt: string;
  lastRun?: string;
  runCount: number;
  status: "active" | "paused" | "error";
  transformations?: Record<string, unknown>;
}

interface TaskCreatorProps {
  task?: AutomationTask;
  onSave: (task: AutomationTask) => void;
  onCancel: () => void;
}

export function TaskCreator({ task, onSave, onCancel }: TaskCreatorProps) {
  const isEdit = !!task;
  const [name, setName] = useState(task?.name || "");
  const [description, setDescription] = useState(task?.description || "");
  const [sources, setSources] = useState<TaskSource[]>(task?.sources || []);
  const [targets, setTargets] = useState<TaskTarget[]>(task?.targets || []);
  const [step, setStep] = useState<"config" | "sources" | "targets" | "review">("config");
  const [addingSource, setAddingSource] = useState(false);
  const [addingTarget, setAddingTarget] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [accountsByPlatform, setAccountsByPlatform] = useState<Record<PlatformType, AccountOption[]>>(
    () => createEmptyAccountsByPlatform()
  );

  useEffect(() => {
    let active = true;
    async function loadAccounts() {
      try {
        const payload = await apiRequest<any>("/api/accounts?limit=200&offset=0&sortBy=createdAt&sortDir=desc");
        if (!active) return;
        const grouped = createEmptyAccountsByPlatform();
        for (const account of (payload.accounts || []) as any[]) {
          const platformId = account.platformId as PlatformType;
          if (!grouped[platformId]) continue;
          const accountId = String(account.id || "").trim();
          if (!accountId) continue;
          const label = String(
            account.accountName || account.accountUsername || account.accountId || ""
          ).trim();
          if (grouped[platformId].some((entry) => entry.id === accountId)) continue;
          grouped[platformId].push({
            id: accountId,
            label: label || accountId,
          });
        }
        setAccountsByPlatform(grouped);
      } catch {
        if (!active) return;
        setAccountsByPlatform(createEmptyAccountsByPlatform());
      }
    }
    void loadAccounts();
    return () => {
      active = false;
    };
  }, []);

  const handleAddSource = () => {
    if (selectedPlatform && selectedAccountId && selectedTrigger) {
      const account =
        accountsByPlatform[selectedPlatform]?.find((entry) => entry.id === selectedAccountId) || null;
      if (!account) return;
      setSources([
        ...sources,
        {
          platformId: selectedPlatform,
          accountId: account.id,
          accountLabel: account.label,
          triggerId: selectedTrigger,
        },
      ]);
      resetSelection();
      setAddingSource(false);
    }
  };

  const handleAddTarget = () => {
    if (selectedPlatform && selectedAccountId && selectedAction) {
      const account =
        accountsByPlatform[selectedPlatform]?.find((entry) => entry.id === selectedAccountId) || null;
      if (!account) return;
      setTargets([
        ...targets,
        {
          platformId: selectedPlatform,
          accountId: account.id,
          accountLabel: account.label,
          actionId: selectedAction,
        },
      ]);
      resetSelection();
      setAddingTarget(false);
    }
  };

  const resetSelection = () => {
    setSelectedPlatform(null);
    setSelectedAccountId("");
    setSelectedTrigger("");
    setSelectedAction("");
  };

  const handleSave = () => {
    const nextEnabled = task?.enabled ?? true;
    const nextStatus = task?.status ?? "active";
    onSave({
      id: task?.id || `task_${Date.now()}`,
      name,
      description,
      enabled: nextEnabled,
      sources,
      targets,
      createdAt: task?.createdAt || new Date().toISOString().split("T")[0],
      lastRun: task?.lastRun,
      runCount: task?.runCount || 0,
      status: nextStatus,
      transformations: task?.transformations,
    });
  };

  const canSave = name.trim() && sources.length > 0 && targets.length > 0;

  const steps = [
    { id: "config", label: "الإعدادات", num: 1 },
    { id: "sources", label: "المصادر", num: 2 },
    { id: "targets", label: "الأهداف", num: 3 },
    { id: "review", label: "المراجعة", num: 4 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex items-center justify-between gap-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <motion.button onClick={onCancel} className="p-2 rounded-xl bg-white hover:bg-slate-50 transition-colors" style={{ border: "1px solid rgba(0,0,0,0.08)" }} whileTap={{ scale: 0.9 }}>
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </motion.button>
          <div>
            <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>{isEdit ? "تعديل المهمة" : "إنشاء مهمة جديدة"}</h2>
            <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>صمم مهمة أتمتة مخصصة بأسلوب n8n</p>
          </div>
        </div>
        <motion.button onClick={handleSave} disabled={!canSave} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2 disabled:opacity-40" style={{ boxShadow: "0 4px 15px rgba(15,23,42,0.2)" }} whileHover={canSave ? { scale: 1.02 } : {}} whileTap={canSave ? { scale: 0.98 } : {}}>
          <Save className="w-4 h-4" /><span>حفظ المهمة</span>
        </motion.button>
      </motion.div>

      {/* Steps indicator */}
      <motion.div className="flex items-center gap-2 p-1 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        {steps.map((s, i) => (
          <button key={s.id} onClick={() => setStep(s.id as typeof step)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all ${step === s.id ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`} style={{ fontSize: "0.8125rem" }}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step === s.id ? "bg-white/20" : "bg-slate-100"}`} style={{ fontSize: "0.625rem" }}>{s.num}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === "config" && (
          <motion.div key="config" className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-slate-800 mb-4" style={{ fontSize: "0.9375rem" }}>إعدادات المهمة الأساسية</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>اسم المهمة</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: نشر تلقائي من Instagram إلى Facebook" className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" style={{ fontSize: "0.875rem" }} />
              </div>
              <div>
                <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>الوصف (اختياري)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="وصف مختصر لما تفعله هذه المهمة" rows={3} className="w-full py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none" style={{ fontSize: "0.875rem" }} />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <motion.button onClick={() => setStep("sources")} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <span>التالي: المصادر</span><ArrowLeft className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "sources" && (
          <motion.div key="sources" className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-800 flex items-center gap-2" style={{ fontSize: "0.9375rem" }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> المصادر (Triggers)
                </h3>
                <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>اختر المنصات والأحداث التي تبدأ المهمة</p>
              </div>
              <motion.button onClick={() => { resetSelection(); setAddingSource(true); }} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 flex items-center gap-1.5" style={{ border: "1px solid rgba(59,130,246,0.15)", fontSize: "0.8125rem" }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Plus className="w-4 h-4" /><span>إضافة مصدر</span>
              </motion.button>
            </div>

            {/* Existing sources */}
            <div className="space-y-2 mb-4">
              {sources.map((src, i) => {
                const pf = platforms.find((p) => p.id === src.platformId);
                const trigger = platformAutomation[src.platformId]?.triggers.find((t) => t.id === src.triggerId);
                return (
                  <motion.div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50" style={{ border: "1px solid rgba(59,130,246,0.1)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
                    {getPlatformIcon(src.platformId, 24)}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{pf?.name} - {src.accountLabel}</p>
                      <p className="text-blue-600" style={{ fontSize: "0.6875rem" }}>{trigger?.icon} {trigger?.label}</p>
                    </div>
                    <motion.button onClick={() => setSources(sources.filter((_, si) => si !== i))} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" whileTap={{ scale: 0.9 }}>
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>

            {/* Add source form */}
            <AnimatePresence>
              {addingSource && (
                <motion.div className="p-4 rounded-xl bg-slate-50" style={{ border: "1px solid rgba(0,0,0,0.06)" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <PlatformNodeSelector mode="trigger" selectedPlatform={selectedPlatform} selectedAccountId={selectedAccountId} selectedItem={selectedTrigger}
                    accountsByPlatform={accountsByPlatform}
                    onPlatformSelect={setSelectedPlatform} onAccountSelect={setSelectedAccountId} onItemSelect={setSelectedTrigger} />
                  <div className="flex items-center gap-2 mt-3">
                    <motion.button onClick={handleAddSource} disabled={!selectedPlatform || !selectedAccountId || !selectedTrigger} className="px-4 py-2 rounded-xl bg-blue-600 text-white flex items-center gap-1.5 disabled:opacity-40" style={{ fontSize: "0.8125rem" }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <CheckCircle className="w-4 h-4" /><span>إضافة</span>
                    </motion.button>
                    <motion.button onClick={() => setAddingSource(false)} className="px-4 py-2 rounded-xl bg-white text-slate-600" style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
                      إلغاء
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between">
              <motion.button onClick={() => setStep("config")} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 flex items-center gap-2" style={{ fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
                <ArrowRight className="w-4 h-4" /><span>السابق</span>
              </motion.button>
              <motion.button onClick={() => setStep("targets")} disabled={sources.length === 0} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2 disabled:opacity-40" whileHover={sources.length > 0 ? { scale: 1.02 } : {}} whileTap={sources.length > 0 ? { scale: 0.98 } : {}}>
                <span>التالي: الأهداف</span><ArrowLeft className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "targets" && (
          <motion.div key="targets" className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-800 flex items-center gap-2" style={{ fontSize: "0.9375rem" }}>
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-500" /> الأهداف (Actions)
                </h3>
                <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>اختر المنصات والإجراءات التي تُنفذ عند التشغيل</p>
              </div>
              <motion.button onClick={() => { resetSelection(); setAddingTarget(true); }} className="px-3 py-2 rounded-xl bg-violet-50 text-violet-600 flex items-center gap-1.5" style={{ border: "1px solid rgba(139,92,246,0.15)", fontSize: "0.8125rem" }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Plus className="w-4 h-4" /><span>إضافة هدف</span>
              </motion.button>
            </div>

            <div className="space-y-2 mb-4">
              {targets.map((tgt, i) => {
                const pf = platforms.find((p) => p.id === tgt.platformId);
                const action = platformAutomation[tgt.platformId]?.actions.find((a) => a.id === tgt.actionId);
                return (
                  <motion.div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-violet-50/50" style={{ border: "1px solid rgba(139,92,246,0.1)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
                    {getPlatformIcon(tgt.platformId, 24)}
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{pf?.name} - {tgt.accountLabel}</p>
                      <p className="text-violet-600" style={{ fontSize: "0.6875rem" }}>{action?.icon} {action?.label}</p>
                    </div>
                    <motion.button onClick={() => setTargets(targets.filter((_, ti) => ti !== i))} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" whileTap={{ scale: 0.9 }}>
                      <X className="w-3.5 h-3.5 text-red-400" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence>
              {addingTarget && (
                <motion.div className="p-4 rounded-xl bg-slate-50" style={{ border: "1px solid rgba(0,0,0,0.06)" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <PlatformNodeSelector mode="action" selectedPlatform={selectedPlatform} selectedAccountId={selectedAccountId} selectedItem={selectedAction}
                    accountsByPlatform={accountsByPlatform}
                    onPlatformSelect={setSelectedPlatform} onAccountSelect={setSelectedAccountId} onItemSelect={setSelectedAction} />
                  <div className="flex items-center gap-2 mt-3">
                    <motion.button onClick={handleAddTarget} disabled={!selectedPlatform || !selectedAccountId || !selectedAction} className="px-4 py-2 rounded-xl bg-violet-600 text-white flex items-center gap-1.5 disabled:opacity-40" style={{ fontSize: "0.8125rem" }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <CheckCircle className="w-4 h-4" /><span>إضافة</span>
                    </motion.button>
                    <motion.button onClick={() => setAddingTarget(false)} className="px-4 py-2 rounded-xl bg-white text-slate-600" style={{ border: "1px solid rgba(0,0,0,0.08)", fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
                      إلغاء
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-6 flex items-center justify-between">
              <motion.button onClick={() => setStep("sources")} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 flex items-center gap-2" style={{ fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
                <ArrowRight className="w-4 h-4" /><span>السابق</span>
              </motion.button>
              <motion.button onClick={() => setStep("review")} disabled={targets.length === 0} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2 disabled:opacity-40" whileHover={targets.length > 0 ? { scale: 1.02 } : {}} whileTap={targets.length > 0 ? { scale: 0.98 } : {}}>
                <span>المراجعة</span><ArrowLeft className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {step === "review" && (
          <motion.div key="review" className="space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Flow visualization */}
            <div className="rounded-2xl bg-white p-5 sm:p-6" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <h3 className="text-slate-800 mb-1" style={{ fontSize: "0.9375rem" }}>{name || "مهمة بدون اسم"}</h3>
              {description && <p className="text-slate-500 mb-4" style={{ fontSize: "0.8125rem" }}>{description}</p>}

              {/* Visual flow n8n style */}
              <div className="relative py-6 overflow-x-auto">
                <div className="flex items-center gap-4 min-w-max justify-center">
                  {/* Sources */}
                  <div className="space-y-2">
                    {sources.map((src, i) => {
                      const trigger = platformAutomation[src.platformId]?.triggers.find(t => t.id === src.triggerId);
                      return (
                        <motion.div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-l from-blue-50 to-blue-100/50" style={{ border: "2px solid rgba(59,130,246,0.2)", minWidth: 180 }}
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                          {getPlatformIcon(src.platformId, 22)}
                          <div>
                            <p className="text-slate-700" style={{ fontSize: "0.75rem" }}>{platforms.find(p => p.id === src.platformId)?.name}</p>
                            <p className="text-blue-600" style={{ fontSize: "0.625rem" }}>{trigger?.icon} {trigger?.label}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Animated connection */}
                  <div className="flex flex-col items-center gap-1 px-2">
                    <motion.div className="w-16 h-0.5 bg-gradient-to-l from-violet-400 to-blue-400 rounded-full relative overflow-hidden">
                      <motion.div className="absolute inset-y-0 w-4 bg-white/60 rounded-full" animate={{ x: [-16, 64] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                    </motion.div>
                    <Zap className="w-5 h-5 text-amber-500" />
                    <motion.div className="w-16 h-0.5 bg-gradient-to-l from-violet-400 to-blue-400 rounded-full relative overflow-hidden">
                      <motion.div className="absolute inset-y-0 w-4 bg-white/60 rounded-full" animate={{ x: [-16, 64] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.5 }} />
                    </motion.div>
                  </div>

                  {/* Targets */}
                  <div className="space-y-2">
                    {targets.map((tgt, i) => {
                      const action = platformAutomation[tgt.platformId]?.actions.find(a => a.id === tgt.actionId);
                      return (
                        <motion.div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-50 to-violet-100/50" style={{ border: "2px solid rgba(139,92,246,0.2)", minWidth: 180 }}
                          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                          {getPlatformIcon(tgt.platformId, 22)}
                          <div>
                            <p className="text-slate-700" style={{ fontSize: "0.75rem" }}>{platforms.find(p => p.id === tgt.platformId)?.name}</p>
                            <p className="text-violet-600" style={{ fontSize: "0.625rem" }}>{action?.icon} {action?.label}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl bg-white p-5" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-slate-800" style={{ fontFamily: "Space Grotesk", fontSize: "1.25rem" }}>{sources.length}</p><p className="text-slate-500" style={{ fontSize: "0.75rem" }}>مصادر</p></div>
                <div><p className="text-slate-800" style={{ fontFamily: "Space Grotesk", fontSize: "1.25rem" }}>{targets.length}</p><p className="text-slate-500" style={{ fontSize: "0.75rem" }}>أهداف</p></div>
                <div><p className="text-slate-800" style={{ fontFamily: "Space Grotesk", fontSize: "1.25rem" }}>{sources.length * targets.length}</p><p className="text-slate-500" style={{ fontSize: "0.75rem" }}>مسار</p></div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <motion.button onClick={() => setStep("targets")} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 flex items-center gap-2" style={{ fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
                <ArrowRight className="w-4 h-4" /><span>السابق</span>
              </motion.button>
              <motion.button onClick={handleSave} className="px-6 py-3 rounded-2xl bg-slate-800 text-white flex items-center gap-2" style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Sparkles className="w-5 h-5" /><span>{isEdit ? "حفظ التعديلات" : "إنشاء المهمة"}</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Platform/Account/Trigger-Action selector component
function PlatformNodeSelector({ mode, selectedPlatform, selectedAccountId, selectedItem, accountsByPlatform, onPlatformSelect, onAccountSelect, onItemSelect }: {
  mode: "trigger" | "action";
  selectedPlatform: PlatformType | null;
  selectedAccountId: string;
  selectedItem: string;
  accountsByPlatform: Record<PlatformType, AccountOption[]>;
  onPlatformSelect: (p: PlatformType) => void;
  onAccountSelect: (a: string) => void;
  onItemSelect: (t: string) => void;
}) {
  const items = selectedPlatform
    ? mode === "trigger"
      ? platformAutomation[selectedPlatform]?.triggers || []
      : platformAutomation[selectedPlatform]?.actions || []
    : [];

  const accounts = selectedPlatform ? accountsByPlatform[selectedPlatform] || [] : [];

  return (
    <div className="space-y-3">
      {/* Platform selection */}
      <div>
        <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.75rem" }}>اختر المنصة</label>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {platforms.map((p) => (
            <motion.button key={p.id} onClick={() => { onPlatformSelect(p.id); onAccountSelect(""); onItemSelect(""); }}
              className={`p-2.5 rounded-xl flex flex-col items-center gap-1 transition-all ${selectedPlatform === p.id ? "bg-white ring-2 ring-violet-400" : "bg-white/50 hover:bg-white"}`}
              style={{ border: "1px solid rgba(0,0,0,0.06)" }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {getPlatformIcon(p.id, 20)}
              <span className="text-slate-600 truncate w-full text-center" style={{ fontSize: "0.5625rem" }}>{p.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Account selection */}
      {selectedPlatform && accounts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.75rem" }}>اختر الحساب</label>
          <div className="flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <motion.button key={acc.id} onClick={() => onAccountSelect(acc.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${selectedAccountId === acc.id ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                style={{ border: "1px solid rgba(0,0,0,0.06)", fontSize: "0.75rem" }} whileTap={{ scale: 0.97 }}>
                {acc.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {selectedPlatform && accounts.length === 0 && (
        <motion.p
          className="text-slate-500"
          style={{ fontSize: "0.75rem" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          لا توجد حسابات مربوطة لهذه المنصة حتى الآن.
        </motion.p>
      )}

      {/* Trigger/Action selection */}
      {selectedPlatform && selectedAccountId && items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
          <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.75rem" }}>
            {mode === "trigger" ? "اختر الحدث (Trigger)" : "اختر الإجراء (Action)"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
            {items.map((item) => (
              <motion.button key={item.id} onClick={() => onItemSelect(item.id)}
                className={`text-right p-2.5 rounded-lg transition-all flex items-center gap-2 ${selectedItem === item.id ? (mode === "trigger" ? "bg-blue-50 ring-1 ring-blue-300" : "bg-violet-50 ring-1 ring-violet-300") : "bg-white hover:bg-slate-50"}`}
                style={{ border: "1px solid rgba(0,0,0,0.05)", fontSize: "0.75rem" }} whileTap={{ scale: 0.98 }}>
                <span style={{ fontSize: "1rem" }}>{item.icon}</span>
                <div className="min-w-0">
                  <p className="text-slate-700 truncate">{item.label}</p>
                  <p className="text-slate-400 truncate" style={{ fontSize: "0.625rem" }}>{item.description}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
