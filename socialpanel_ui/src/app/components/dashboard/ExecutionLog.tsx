import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Search,
  MessageSquare,
  Image,
  FileText,
  Video,
  MapPin,
  Zap,
} from "lucide-react";
import { getPlatformIcon, platforms, type PlatformType } from "../PlatformIcons";
import { apiRequest } from "../../services/api";

interface ExecutionRecord {
  id: string;
  taskName: string;
  sourcePlatform: PlatformType;
  sourceTrigger: string;
  targets: {
    platformId: PlatformType;
    account: string;
    action: string;
    status: "success" | "failed" | "pending";
  }[];
  status: "success" | "partial" | "failed";
  startedAt: string;
  duration: string;
  contentPreview?: string;
  contentType?: "text" | "image" | "video" | "document" | "location";
}

const contentIcons = {
  text: MessageSquare,
  image: Image,
  video: Video,
  document: FileText,
  location: MapPin,
};

function normalizePlatform(platformId: unknown): PlatformType {
  const value = String(platformId || "");
  return (platforms.some((platform) => platform.id === value)
    ? value
    : "facebook") as PlatformType;
}

function detectContentType(content: string): ExecutionRecord["contentType"] {
  const normalized = content.toLowerCase();
  if (normalized.includes("http") || normalized.includes(".jpg") || normalized.includes(".png")) {
    return "image";
  }
  if (normalized.includes("video") || normalized.includes(".mp4")) {
    return "video";
  }
  if (normalized.includes("pdf") || normalized.includes("document")) {
    return "document";
  }
  if (normalized.includes("map") || normalized.includes("location")) {
    return "location";
  }
  return "text";
}

function mapExecution(exec: any): ExecutionRecord {
  const rawStatus = String(exec.status || "failed").toLowerCase();
  const status: ExecutionRecord["status"] =
    rawStatus === "success" ? "success" : rawStatus === "failed" ? "failed" : "partial";

  const responseDuration = Number(exec?.responseData?.durationMs || exec?.responseData?.duration || 0);
  const duration = Number.isFinite(responseDuration) && responseDuration > 0
    ? `${(responseDuration / 1000).toFixed(1)}s`
    : "—";

  const contentPreview = String(exec.transformedContent || exec.originalContent || "").trim();

  return {
    id: String(exec.id),
    taskName: String(exec.taskName || "Task"),
    sourcePlatform: normalizePlatform(exec.sourcePlatformId),
    sourceTrigger: String(exec.sourceAccountName || exec.sourceAccount || "Source"),
    targets: [
      {
        platformId: normalizePlatform(exec.targetPlatformId),
        account: String(exec.targetAccountName || exec.targetAccount || "Target"),
        action: "Dispatch",
        status: status === "success" ? "success" : status === "failed" ? "failed" : "pending",
      },
    ],
    status,
    startedAt: exec.executedAt ? new Date(exec.executedAt).toLocaleString("ar") : "",
    duration,
    contentPreview: contentPreview || undefined,
    contentType: contentPreview ? detectContentType(contentPreview) : "text",
  };
}

export function ExecutionLog() {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "success" | "partial" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadExecutions() {
      try {
        const payload = await apiRequest<any>("/api/executions?limit=100&offset=0&sortBy=executedAt&sortDir=desc");
        if (!active) return;
        const mapped = ((payload.executions || []) as any[]).map(mapExecution);
        setExecutions(mapped);
      } catch {
        if (!active) return;
        setExecutions([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadExecutions();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => executions.filter((execution) => {
      const matchFilter = filter === "all" || execution.status === filter;
      const matchSearch =
        execution.taskName.includes(searchQuery) ||
        (execution.contentPreview || "").includes(searchQuery);
      return matchFilter && matchSearch;
    }),
    [executions, filter, searchQuery]
  );

  const stats = useMemo(
    () => ({
      total: executions.length,
      success: executions.filter((execution) => execution.status === "success").length,
      partial: executions.filter((execution) => execution.status === "partial").length,
      failed: executions.filter((execution) => execution.status === "failed").length,
    }),
    [executions]
  );

  const statusConfig = {
    success: {
      icon: CheckCircle,
      label: "ناجح",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    partial: {
      icon: AlertTriangle,
      label: "جزئي",
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    failed: {
      icon: XCircle,
      label: "فشل",
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
    },
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="px-3 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(59,130,246,0.15)" }}>
            <span className="text-blue-700" style={{ fontSize: "0.75rem" }}>سجل التنفيذات</span>
          </div>
        </div>
        <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>سجل التنفيذات والتوجيهات</h2>
        <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>تتبع جميع عمليات الأتمتة مع تفاصيل المحتوى والحالة</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التنفيذات", value: stats.total, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "ناجحة", value: stats.success, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "جزئية", value: stats.partial, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "فاشلة", value: stats.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
        ].map((item, index) => (
          <motion.div
            key={index}
            className="p-4 rounded-2xl bg-white"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-2`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <p className="text-slate-800" style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk" }}>{item.value}</p>
            <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{item.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث في السجلات..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full py-2.5 pr-10 pl-4 rounded-xl bg-white border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            style={{ fontSize: "0.875rem" }}
          />
        </div>
        <div className="flex items-center rounded-xl bg-white overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          {(["all", "success", "partial", "failed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2.5 transition-all ${filter === status ? "bg-slate-800 text-white rounded-xl" : "text-slate-500 hover:bg-slate-50"}`}
              style={{ fontSize: "0.75rem" }}
            >
              {status === "all" ? "الكل" : status === "success" ? "ناجح" : status === "partial" ? "جزئي" : "فشل"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          جاري تحميل التنفيذات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          لا توجد بيانات تنفيذ حالياً.
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((execution, index) => {
              const status = statusConfig[execution.status];
              const ContentIcon = contentIcons[execution.contentType || "text"];
              return (
                <motion.div
                  key={execution.id}
                  className="rounded-2xl bg-white overflow-hidden"
                  style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <div className="p-4 sm:p-5 cursor-pointer" onClick={() => setExpandedId(expandedId === execution.id ? null : execution.id)}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center shrink-0`}>
                        <status.icon className={`w-4 h-4 ${status.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="text-slate-800 truncate" style={{ fontSize: "0.875rem" }}>{execution.taskName}</h4>
                          <span className={`px-2 py-0.5 rounded-full ${status.bg} ${status.color} border ${status.border}`} style={{ fontSize: "0.6rem" }}>
                            {status.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50" style={{ border: "1px solid rgba(59,130,246,0.1)" }}>
                            {getPlatformIcon(execution.sourcePlatform, 14)}
                            <span className="text-blue-700" style={{ fontSize: "0.625rem" }}>{execution.sourceTrigger}</span>
                          </div>

                          <ArrowLeft className="w-4 h-4 text-slate-300" />

                          {execution.targets.map((target, targetIndex) => (
                            <motion.div
                              key={targetIndex}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md ${target.status === "success" ? "bg-emerald-50" : target.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}
                              style={{ border: `1px solid ${target.status === "success" ? "rgba(16,185,129,0.15)" : target.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.06)"}` }}
                            >
                              {getPlatformIcon(target.platformId, 14)}
                              <span className={`${target.status === "success" ? "text-emerald-700" : target.status === "failed" ? "text-red-600" : "text-slate-500"}`} style={{ fontSize: "0.625rem" }}>{target.action}</span>
                              {target.status === "success" && <CheckCircle className="w-2.5 h-2.5 text-emerald-500" />}
                              {target.status === "failed" && <XCircle className="w-2.5 h-2.5 text-red-500" />}
                            </motion.div>
                          ))}
                        </div>

                        {execution.contentPreview && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50/80" style={{ border: "1px solid rgba(0,0,0,0.04)" }}>
                            <ContentIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <p className="text-slate-600 line-clamp-2" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>{execution.contentPreview}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.625rem" }}>
                            <Clock className="w-3 h-3" /> {execution.startedAt}
                          </span>
                          <span className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.625rem" }}>
                            <Zap className="w-3 h-3" /> {execution.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
