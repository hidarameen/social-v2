import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Target,
} from "lucide-react";
import { apiRequest } from "../../services/api";

interface TaskStat {
  taskId: string;
  taskName: string;
  totalExecutions: number;
  successful: number;
  failed: number;
  successRate: number;
}

interface AnalyticsPayload {
  totals?: {
    tasks?: number;
    executions?: number;
    successfulExecutions?: number;
    failedExecutions?: number;
  };
  taskStats?: TaskStat[];
}

const chartColors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f97316", "#ef4444"];

export function AnalyticsPageNew() {
  const [payload, setPayload] = useState<AnalyticsPayload>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadAnalytics() {
      try {
        const response = await apiRequest<AnalyticsPayload>(
          "/api/analytics?limit=100&offset=0&sortBy=successRate&sortDir=desc"
        );
        if (!active) return;
        setPayload(response);
      } catch {
        if (!active) return;
        setPayload({ totals: { tasks: 0, executions: 0, successfulExecutions: 0, failedExecutions: 0 }, taskStats: [] });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadAnalytics();
    return () => {
      active = false;
    };
  }, []);

  const totals = {
    tasks: Number(payload.totals?.tasks || 0),
    executions: Number(payload.totals?.executions || 0),
    successful: Number(payload.totals?.successfulExecutions || 0),
    failed: Number(payload.totals?.failedExecutions || 0),
  };
  const successRate = totals.executions > 0 ? Math.round((totals.successful / totals.executions) * 100) : 0;

  const taskStats = useMemo(() => (payload.taskStats || []).slice(0, 8), [payload.taskStats]);

  const executionsByTask = taskStats.map((task) => ({
    name: task.taskName.length > 14 ? `${task.taskName.slice(0, 14)}...` : task.taskName,
    executions: task.totalExecutions,
  }));

  const successByTask = taskStats.map((task) => ({
    name: task.taskName.length > 14 ? `${task.taskName.slice(0, 14)}...` : task.taskName,
    successRate: task.successRate,
  }));

  const statusBreakdown = [
    { name: "ناجحة", value: totals.successful, color: "#10b981" },
    { name: "فاشلة", value: totals.failed, color: "#ef4444" },
  ];

  const kpiCards = [
    { icon: Target, label: "المهام", value: totals.tasks, color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Activity, label: "إجمالي التنفيذات", value: totals.executions, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: CheckCircle, label: "التنفيذات الناجحة", value: totals.successful, color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: XCircle, label: "التنفيذات الفاشلة", value: totals.failed, color: "text-red-600", bg: "bg-red-50" },
    { icon: TrendingUp, label: "نسبة النجاح", value: `${successRate}%`, color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="px-3 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(59,130,246,0.15)" }}>
            <span className="text-blue-700" style={{ fontSize: "0.75rem" }}>التحليلات المباشرة</span>
          </div>
        </div>
        <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>تحليلات الأداء</h2>
        <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>بيانات حقيقية من تنفيذات المهام والحالة العامة</p>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card, index) => (
          <motion.div
            key={index}
            className="p-4 rounded-2xl bg-white"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
          >
            <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-2`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <p className="text-slate-800" style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk" }}>{card.value}</p>
            <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{card.label}</p>
          </motion.div>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          جاري تحميل بيانات التحليلات...
        </div>
      ) : taskStats.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center text-slate-500" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          لا توجد بيانات تحليلات متاحة بعد.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <motion.div
              className="p-5 rounded-2xl bg-white"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>التنفيذات حسب المهمة</h3>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={executionsByTask}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={55} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="executions" radius={[6, 6, 0, 0]}>
                    {executionsByTask.map((_, index) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              className="p-5 rounded-2xl bg-white"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>توزيع النجاح والفشل</h3>
                <PieIcon className="w-4 h-4 text-slate-400" />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value">
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          <motion.div
            className="p-5 rounded-2xl bg-white"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-slate-800 mb-4" style={{ fontSize: "0.9375rem" }}>نسبة نجاح كل مهمة</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={successByTask}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={55} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(value) => [`${value}%`, "نسبة النجاح"]} />
                <Line type="monotone" dataKey="successRate" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            className="p-5 rounded-2xl bg-white"
            style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h3 className="text-slate-800 mb-4" style={{ fontSize: "0.9375rem" }}>تفاصيل المهام</h3>
            <div className="space-y-2">
              {taskStats.map((task) => (
                <div key={task.taskId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                  <div className="min-w-0">
                    <p className="text-slate-700 truncate" style={{ fontSize: "0.8125rem" }}>{task.taskName}</p>
                    <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                      {task.totalExecutions} تنفيذ • {task.successful} ناجح • {task.failed} فاشل
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-violet-50 text-violet-700" style={{ fontSize: "0.75rem" }}>
                    {task.successRate}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
