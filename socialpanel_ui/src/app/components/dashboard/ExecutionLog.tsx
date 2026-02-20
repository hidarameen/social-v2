import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity, CheckCircle, XCircle, Clock, AlertTriangle,
  ArrowLeft, Search, Filter, Eye, RefreshCw, ChevronDown, X,
  Zap, MessageSquare, Image, FileText, Video, MapPin,
} from "lucide-react";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";

interface ExecutionRecord {
  id: string;
  taskName: string;
  sourcePlatform: PlatformType;
  sourceAccount: string;
  sourceTrigger: string;
  targets: { platformId: PlatformType; account: string; action: string; status: "success" | "failed" | "pending" }[];
  status: "success" | "partial" | "failed" | "running";
  startedAt: string;
  duration: string;
  contentPreview?: string;
  contentType?: "text" | "image" | "video" | "document" | "location";
}

const mockExecutions: ExecutionRecord[] = [
  {
    id: "exec_1", taskName: "نشر تلقائي من Instagram إلى Facebook و X",
    sourcePlatform: "instagram", sourceAccount: "@design_pro", sourceTrigger: "منشور جديد",
    targets: [
      { platformId: "facebook", account: "Creative Studio", action: "إنشاء منشور", status: "success" },
      { platformId: "twitter", account: "@tech_news", action: "إنشاء تغريدة", status: "success" },
    ],
    status: "success", startedAt: "14:30:22", duration: "2.3s",
    contentPreview: "تصميم جديد لهوية بصرية متكاملة لعلامة تجارية عالمية. شاهد التفاصيل الكاملة في المنشور #تصميم #هوية_بصرية #إبداع", contentType: "image",
  },
  {
    id: "exec_2", taskName: "تحويل رسائل Telegram إلى WhatsApp",
    sourcePlatform: "telegram", sourceAccount: "@channel_bot", sourceTrigger: "رسالة جديدة",
    targets: [{ platformId: "whatsapp", account: "+966 50 XXX", action: "إرسال رسالة", status: "success" }],
    status: "success", startedAt: "15:12:05", duration: "1.1s",
    contentPreview: "مرحباً! تم استلام طلبكم رقم #4521 وسيتم معالجته خلال 24 ساعة. شكراً لتواصلكم.", contentType: "text",
  },
  {
    id: "exec_3", taskName: "إشعار YouTube على جميع المنصات",
    sourcePlatform: "youtube", sourceAccount: "Channel Pro", sourceTrigger: "فيديو جديد",
    targets: [
      { platformId: "facebook", account: "Creative Studio", action: "إنشاء منشور", status: "success" },
      { platformId: "instagram", account: "@design_pro", action: "إنشاء منشور", status: "failed" },
      { platformId: "twitter", account: "@tech_news", action: "إنشاء تغريدة", status: "success" },
      { platformId: "telegram", account: "@channel_bot", action: "إرسال رسالة", status: "success" },
    ],
    status: "partial", startedAt: "09:45:33", duration: "4.7s",
    contentPreview: "فيديو جديد: كيف تبني علامتك التجارية على السوشيال ميديا في 2026 - الدليل الشامل", contentType: "video",
  },
  {
    id: "exec_4", taskName: "مراقبة التقييمات على Google",
    sourcePlatform: "google_business", sourceAccount: "My Business", sourceTrigger: "تقييم جديد",
    targets: [
      { platformId: "telegram", account: "@channel_bot", action: "إرسال رسالة", status: "success" },
      { platformId: "whatsapp", account: "+966 50 XXX", action: "إرسال رسالة", status: "failed" },
    ],
    status: "partial", startedAt: "11:22:15", duration: "3.1s",
    contentPreview: "⭐⭐⭐⭐⭐ تقييم جديد من عميل: خدمة ممتازة وسريعة! أنصح الجميع بالتعامل معهم.", contentType: "text",
  },
];

const contentIcons = { text: MessageSquare, image: Image, video: Video, document: FileText, location: MapPin };

export function ExecutionLog() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>(mockExecutions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "success" | "partial" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [liveExecution, setLiveExecution] = useState<string | null>(null);
  const [animatingTargets, setAnimatingTargets] = useState<Record<string, number>>({});

  // Simulate a live execution periodically
  useEffect(() => {
    const innerTimers: ReturnType<typeof setInterval>[] = [];
    
    const timer = setInterval(() => {
      const exec: ExecutionRecord = {
        id: `exec_live_${Date.now()}`,
        taskName: ["نشر تلقائي", "تحويل رسائل", "مراقبة التقييمات"][Math.floor(Math.random() * 3)],
        sourcePlatform: (["instagram", "telegram", "facebook"] as PlatformType[])[Math.floor(Math.random() * 3)],
        sourceAccount: "@live_demo", sourceTrigger: "حدث جديد",
        targets: [
          { platformId: "facebook", account: "Page", action: "نشر", status: "pending" },
          { platformId: "twitter", account: "@acc", action: "تغريدة", status: "pending" },
        ],
        status: "running", startedAt: new Date().toLocaleTimeString("ar"), duration: "...",
        contentPreview: "محتوى تجريبي يتم تنفيذه الآن...", contentType: "text",
      };
      setLiveExecution(exec.id);

      // Animate targets completing one by one
      let targetIdx = 0;
      const targetTimer = setInterval(() => {
        if (targetIdx < exec.targets.length) {
          exec.targets[targetIdx].status = "success";
          setAnimatingTargets((p) => ({ ...p, [exec.id]: targetIdx }));
          targetIdx++;
        } else {
          clearInterval(targetTimer);
          exec.status = "success";
          exec.duration = `${(Math.random() * 3 + 0.5).toFixed(1)}s`;
          setExecutions((prev) => [exec, ...prev.slice(0, 9)]);
          setTimeout(() => setLiveExecution(null), 1000);
        }
      }, 800);
      innerTimers.push(targetTimer);
    }, 15000);

    return () => {
      clearInterval(timer);
      innerTimers.forEach((t) => clearInterval(t));
    };
  }, []);

  const filtered = executions.filter((e) => {
    const matchFilter = filter === "all" || e.status === filter;
    const matchSearch = e.taskName.includes(searchQuery) || (e.contentPreview || "").includes(searchQuery);
    return matchFilter && matchSearch;
  });

  const stats = {
    total: executions.length,
    success: executions.filter((e) => e.status === "success").length,
    partial: executions.filter((e) => e.status === "partial").length,
    failed: executions.filter((e) => e.status === "failed").length,
  };

  const statusConfig = {
    success: { icon: CheckCircle, label: "ناجح", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
    partial: { icon: AlertTriangle, label: "جزئي", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
    failed: { icon: XCircle, label: "فشل", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    running: { icon: RefreshCw, label: "يعمل", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="px-3 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(59,130,246,0.15)" }}>
            <span className="text-blue-700" style={{ fontSize: "0.75rem" }}>سجل التنفيذات</span>
          </div>
          {liveExecution && (
            <motion.div className="px-3 py-1 rounded-full bg-emerald-50 flex items-center gap-1.5" style={{ border: "1px solid rgba(16,185,129,0.15)" }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div className="w-2 h-2 rounded-full bg-emerald-500" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              <span className="text-emerald-700" style={{ fontSize: "0.75rem" }}>تنفيذ حي</span>
            </motion.div>
          )}
        </div>
        <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>سجل التنفيذات والتوجيهات</h2>
        <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>تتبع جميع عمليات الأتمتة مع تفاصيل المحتوى والحالة</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التنفيذات", value: stats.total, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "ناجحة", value: stats.success, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "جزئية", value: stats.partial, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "فاشلة", value: stats.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map((s, i) => (
          <motion.div key={i} className="p-4 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} whileHover={{ scale: 1.02 }}>
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-2`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <p className="text-slate-800" style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk" }}>{s.value}</p>
            <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="ابحث في السجلات..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pr-10 pl-4 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" style={{ fontSize: "0.875rem" }} />
        </div>
        <div className="flex items-center rounded-xl bg-white overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          {(["all", "success", "partial", "failed"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2.5 transition-all ${filter === f ? "bg-slate-800 text-white rounded-xl" : "text-slate-500 hover:bg-slate-50"}`} style={{ fontSize: "0.75rem" }}>
              {f === "all" ? "الكل" : f === "success" ? "ناجح" : f === "partial" ? "جزئي" : "فشل"}
            </button>
          ))}
        </div>
      </div>

      {/* Executions */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map((exec, i) => {
            const statusCfg = statusConfig[exec.status];
            const ContentIcon = contentIcons[exec.contentType || "text"];
            return (
              <motion.div key={exec.id} className="rounded-2xl bg-white overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ delay: i * 0.03 }} layout>

                <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === exec.id ? null : exec.id)}>
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <motion.div className={`mt-1 w-8 h-8 rounded-lg ${statusCfg.bg} flex items-center justify-center shrink-0`}
                      animate={exec.status === "running" ? { rotate: 360 } : {}} transition={exec.status === "running" ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}>
                      <statusCfg.icon className={`w-4 h-4 ${statusCfg.color}`} />
                    </motion.div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-slate-800 truncate" style={{ fontSize: "0.875rem" }}>{exec.taskName}</h4>
                        <span className={`px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color} border ${statusCfg.border}`} style={{ fontSize: "0.6rem" }}>
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Flow visualization with animation */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50" style={{ border: "1px solid rgba(59,130,246,0.1)" }}>
                          {getPlatformIcon(exec.sourcePlatform, 14)}
                          <span className="text-blue-700" style={{ fontSize: "0.625rem" }}>{exec.sourceTrigger}</span>
                        </div>

                        <motion.div animate={exec.status === "running" ? { x: [0, 6, 0] } : {}} transition={{ duration: 0.8, repeat: Infinity }}>
                          <ArrowLeft className={`w-4 h-4 ${exec.status === "success" ? "text-emerald-500" : exec.status === "running" ? "text-blue-500" : "text-slate-300"}`} />
                        </motion.div>

                        {exec.targets.map((tgt, ti) => (
                          <motion.div key={ti} className={`flex items-center gap-1 px-2 py-1 rounded-md ${tgt.status === "success" ? "bg-emerald-50" : tgt.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}
                            style={{ border: `1px solid ${tgt.status === "success" ? "rgba(16,185,129,0.15)" : tgt.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.06)"}` }}
                            initial={exec.status === "running" ? { opacity: 0, scale: 0.8 } : {}} animate={{ opacity: 1, scale: 1 }} transition={{ delay: ti * 0.3 }}>
                            {getPlatformIcon(tgt.platformId, 14)}
                            <span className={`${tgt.status === "success" ? "text-emerald-700" : tgt.status === "failed" ? "text-red-600" : "text-slate-500"}`} style={{ fontSize: "0.625rem" }}>{tgt.action}</span>
                            {tgt.status === "success" && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                            {tgt.status === "failed" && <XCircle className="w-2.5 h-2.5 text-red-500" />}
                          </motion.div>
                        ))}
                      </div>

                      {/* Content preview */}
                      {exec.contentPreview && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50/80" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
                          <ContentIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-slate-600 line-clamp-2" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{exec.contentPreview}</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.625rem" }}>
                          <Clock className="w-3 h-3" /> {exec.startedAt}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.625rem" }}>
                          <Zap className="w-3 h-3" /> {exec.duration}
                        </span>
                        <span className="text-slate-400" style={{ fontSize: "0.625rem" }}>
                          {exec.targets.filter((t) => t.status === "success").length}/{exec.targets.length} أهداف
                        </span>
                      </div>
                    </div>

                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expandedId === exec.id ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {expandedId === exec.id && (
                    <motion.div className="px-5 pb-5 border-t border-slate-100 pt-4" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      {/* Detailed flow with progress */}
                      <h5 className="text-slate-700 mb-3" style={{ fontSize: "0.8125rem" }}>تفاصيل التنفيذ</h5>

                      <div className="space-y-2">
                        {exec.targets.map((tgt, ti) => (
                          <motion.div key={ti} className="relative" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ti * 0.1 }}>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                              {/* Source */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {getPlatformIcon(exec.sourcePlatform, 18)}
                                <span className="text-slate-600" style={{ fontSize: "0.6875rem" }}>{exec.sourceAccount}</span>
                              </div>

                              {/* Progress bar */}
                              <div className="flex-1 relative h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                <motion.div
                                  className={`absolute inset-y-0 right-0 rounded-full ${tgt.status === "success" ? "bg-emerald-400" : tgt.status === "failed" ? "bg-red-400" : "bg-blue-400"}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: tgt.status === "pending" ? "40%" : "100%" }}
                                  transition={{ duration: 0.8, delay: ti * 0.2 }}
                                />
                                {tgt.status === "success" && (
                                  <motion.div className="absolute inset-y-0 w-3 bg-white/50 rounded-full" initial={{ right: "100%" }} animate={{ right: "0%" }} transition={{ duration: 0.5, delay: ti * 0.2 + 0.3 }} />
                                )}
                              </div>

                              {/* Target */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {getPlatformIcon(tgt.platformId, 18)}
                                <span className="text-slate-600" style={{ fontSize: "0.6875rem" }}>{tgt.account}</span>
                                {tgt.status === "success" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                {tgt.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Full content */}
                      {exec.contentPreview && (
                        <div className="mt-3 p-3 rounded-xl bg-violet-50/30" style={{ border: "1px solid rgba(139,92,246,0.08)" }}>
                          <p className="text-slate-500 mb-1" style={{ fontSize: "0.6875rem" }}>المحتوى المرسل:</p>
                          <p className="text-slate-700" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>{exec.contentPreview}</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}