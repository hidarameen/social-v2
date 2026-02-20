import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Globe, Activity, TrendingUp, Users, ArrowUpRight,
  Zap, Clock, Sparkles, Target, BarChart3, ArrowLeft,
  CheckCircle, AlertTriangle, Play, Eye, Heart,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { getPlatformIcon, type PlatformType } from "../PlatformIcons";
import { apiRequest } from "../../services/api";

export function DashboardHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboardPayload, setDashboardPayload] = useState<any>(null);

  const stats = [
    { icon: Globe, label: "إجمالي الحسابات", value: "3", change: "+1", up: true, color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Zap, label: "مهام نشطة", value: "2", change: "+1", up: true, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Activity, label: "تنفيذات اليوم", value: "47", change: "+12", up: true, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Users, label: "إجمالي المتابعين", value: "65.8K", change: "+2.3K", up: true, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const recentExecutions = [
    { source: "instagram" as PlatformType, target: "facebook" as PlatformType, task: "نشر تلقائي", status: "success", time: "منذ 5 دقائق", content: "تصميم هوية بصرية جديدة..." },
    { source: "telegram" as PlatformType, target: "whatsapp" as PlatformType, task: "تحويل رسائل", status: "success", time: "منذ 12 دقيقة", content: "تم استلام طلب جديد #4521" },
    { source: "youtube" as PlatformType, target: "twitter" as PlatformType, task: "إعلان فيديو", status: "partial", time: "منذ ساعة", content: "فيديو جديد: دليل التسويق الرقمي" },
    { source: "instagram" as PlatformType, target: "linkedin" as PlatformType, task: "نشر تلقائي", status: "success", time: "منذ ساعتين", content: "نصائح لبناء العلامة التجارية" },
  ];

  const activeTasks = [
    { name: "نشر تلقائي Instagram → Facebook + X", runs: 47, status: "active" },
    { name: "تحويل رسائل Telegram → WhatsApp", runs: 123, status: "active" },
    { name: "إشعار YouTube → جميع المنصات", runs: 12, status: "paused" },
  ];

  const quickActions = [
    { icon: Zap, label: "إنشاء مهمة", desc: "أتمتة جديدة", color: "text-amber-600", bg: "bg-amber-50", path: "/dashboard/tasks" },
    { icon: Globe, label: "ربط حساب", desc: "منصة جديدة", color: "text-violet-600", bg: "bg-violet-50", path: "/dashboard/accounts" },
    { icon: BarChart3, label: "التحليلات", desc: "تقارير الأداء", color: "text-blue-600", bg: "bg-blue-50", path: "/dashboard/analytics" },
    { icon: Eye, label: "سجل التنفيذات", desc: "آخر العمليات", color: "text-emerald-600", bg: "bg-emerald-50", path: "/dashboard/executions" },
  ];

  const suggestions = [
    { icon: Sparkles, title: "إنشاء مهمة نشر متعدد", desc: "انشر على 5 منصات بضغطة واحدة عبر مهمة أتمتة", color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Target, title: "ربط Google Business", desc: "أضف حساب Google Business لتلقي إشعارات التقييمات", color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Zap, title: "تفعيل مراقبة الكلمات", desc: "راقب الإشارات والكلمات المفتاحية عبر X تلقائياً", color: "text-amber-600", bg: "bg-amber-50" },
  ];

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const payload = await apiRequest<any>("/api/dashboard?limit=8");
        if (!active) return;
        setDashboardPayload(payload);
      } catch {
        if (active) setDashboardPayload(null);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const dynamicStats = dashboardPayload
    ? [
        { icon: Globe, label: "إجمالي الحسابات", value: String(dashboardPayload.stats?.totalAccounts ?? 0), change: "", up: true, color: "text-violet-600", bg: "bg-violet-50" },
        { icon: Zap, label: "مهام نشطة", value: String(dashboardPayload.stats?.activeTasksCount ?? 0), change: "", up: true, color: "text-amber-600", bg: "bg-amber-50" },
        { icon: Activity, label: "إجمالي التنفيذات", value: String(dashboardPayload.stats?.totalExecutions ?? 0), change: "", up: true, color: "text-blue-600", bg: "bg-blue-50" },
        { icon: Users, label: "نسبة النجاح", value: `${dashboardPayload.stats?.executionSuccessRate ?? 0}%`, change: "", up: true, color: "text-rose-600", bg: "bg-rose-50" },
      ]
    : stats;

  const dynamicRecentExecutions = dashboardPayload?.recentExecutions
    ? (dashboardPayload.recentExecutions as any[]).slice(0, 4).map((exec: any) => ({
        source: (exec.sourcePlatformId || "twitter") as PlatformType,
        target: (exec.targetPlatformId || "facebook") as PlatformType,
        task: exec.taskName || "Task",
        status: exec.status === "success" ? "success" : "partial",
        time: exec.executedAt ? new Date(exec.executedAt).toLocaleString("ar") : "الآن",
        content: String(exec.originalContent || exec.transformedContent || "No content"),
      }))
    : recentExecutions;

  const dynamicActiveTasks = dashboardPayload?.recentTasks
    ? (dashboardPayload.recentTasks as any[]).slice(0, 4).map((task: any) => ({
        name: String(task.name || "Task"),
        runs: Number(task.executionCount || 0),
        status: String(task.status || "paused"),
      }))
    : activeTasks;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "صباح الخير";
    return "مساء الخير";
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div className="p-5 sm:p-6 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.04), rgba(236,72,153,0.03))", border: "1px solid rgba(139,92,246,0.1)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>
              {getGreeting()}، {user?.name?.split(" ")[0] || "مستخدم"} 👋
            </h2>
            <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>إليك ملخص نشاط مهامك وحساباتك</p>
          </div>
          <motion.button onClick={() => navigate("/dashboard/tasks")} className="px-4 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2" style={{ boxShadow: "0 4px 15px rgba(15,23,42,0.2)", fontSize: "0.8125rem" }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Zap className="w-4 h-4" /><span>إنشاء مهمة أتمتة</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {dynamicStats.map((stat, i) => (
          <motion.div key={i} className="p-4 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }} whileHover={{ scale: 1.02, y: -2 }}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}><stat.icon className={`w-5 h-5 ${stat.color}`} /></div>
                {stat.change ? (
                  <div className="flex items-center gap-0.5 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full" style={{ fontSize: "0.6875rem" }}>
                    <ArrowUpRight className="w-3 h-3" />{stat.change}
                  </div>
                ) : null}
            </div>
            <p className="text-slate-800" style={{ fontSize: "1.5rem", fontFamily: "Space Grotesk, sans-serif" }}>{stat.value}</p>
            <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 className="text-slate-700 mb-3" style={{ fontSize: "0.9375rem" }}>إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <motion.button key={i} onClick={() => navigate(action.path)} className="p-4 rounded-2xl bg-white text-right group" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
              whileHover={{ scale: 1.02, y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }} whileTap={{ scale: 0.98 }}>
              <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </div>
              <p className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{action.label}</p>
              <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Executions */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>آخر التنفيذات</h3>
            <motion.button onClick={() => navigate("/dashboard/executions")} className="text-violet-600 hover:text-violet-700" style={{ fontSize: "0.75rem" }}>عرض الكل</motion.button>
          </div>
          <div className="space-y-2.5">
            {dynamicRecentExecutions.map((exec, i) => (
              <motion.div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.05 }}>
                <div className="flex items-center gap-1 shrink-0">
                  {getPlatformIcon(exec.source, 18)}
                  <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <ArrowLeft className={`w-3.5 h-3.5 ${exec.status === "success" ? "text-emerald-500" : "text-amber-500"}`} />
                  </motion.div>
                  {getPlatformIcon(exec.target, 18)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 truncate" style={{ fontSize: "0.8125rem" }}>{exec.content}</p>
                  <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{exec.task}</p>
                </div>
                <div className="text-left shrink-0">
                  {exec.status === "success" ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  <p className="text-slate-400" style={{ fontSize: "0.5625rem" }}>{exec.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Active Tasks */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>المهام النشطة</h3>
            <motion.button onClick={() => navigate("/dashboard/tasks")} className="text-violet-600 hover:text-violet-700" style={{ fontSize: "0.75rem" }}>عرض الكل</motion.button>
          </div>
          <div className="space-y-2.5">
            {dynamicActiveTasks.map((task, i) => (
              <motion.div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.05 }} onClick={() => navigate("/dashboard/tasks")}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${task.status === "active" ? "bg-emerald-50" : "bg-slate-100"}`}>
                  {task.status === "active" ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 truncate" style={{ fontSize: "0.8125rem" }}>{task.name}</p>
                  <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>{task.runs} تنفيذ</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full ${task.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`} style={{ fontSize: "0.625rem" }}>
                  {task.status === "active" ? "نشطة" : "متوقفة"}
                </span>
              </motion.div>
            ))}
          </div>
          <motion.button onClick={() => navigate("/dashboard/tasks")} className="w-full mt-3 py-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5" style={{ fontSize: "0.8125rem" }} whileTap={{ scale: 0.98 }}>
            <Zap className="w-4 h-4" /> إنشاء مهمة جديدة
          </motion.button>
        </motion.div>
      </div>

      {/* AI Suggestions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <h3 className="text-slate-700" style={{ fontSize: "0.9375rem" }}>اقتراحات ذكية</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {suggestions.map((sug, i) => (
            <motion.div key={i} className="p-4 rounded-2xl bg-white group cursor-pointer" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
              whileHover={{ scale: 1.02, y: -2 }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.06 }}>
              <div className={`w-9 h-9 rounded-lg ${sug.bg} flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform`}>
                <sug.icon className={`w-4 h-4 ${sug.color}`} />
              </div>
              <p className="text-slate-700 mb-0.5" style={{ fontSize: "0.8125rem" }}>{sug.title}</p>
              <p className="text-slate-400" style={{ fontSize: "0.6875rem", lineHeight: 1.5 }}>{sug.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Feature roadmap */}
      <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>ميزات قادمة</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            "قوالب نشر مخصصة لكل منصة (Instagram Reels, X Threads, YouTube Shorts)",
            "ذكاء اصطناعي لتوليد المحتوى وتحسين النشر",
            "مراقبة إشارات العلامة التجارية في الوقت الحقيقي",
            "تقارير PDF تلقائية أسبوعية وشهرية",
            "اختبار A/B للمنشورات عبر المنصات",
            "تكامل مع Canva و Adobe Express",
            "فلاتر متقدمة للمهام (حسب المنصة، الحالة، التاريخ)",
            "تحليل المشاعر للتعليقات والردود",
            "نظام صلاحيات متعدد المستويات للفريق",
            "تقويم محتوى تفاعلي بالسحب والإفلات",
            "Webhook مخصص لربط أنظمة خارجية",
            "تشفير end-to-end للرسائل المحولة",
            "دعم الرد التلقائي الذكي بالـ AI",
            "لوحة تحكم مخصصة (Custom Widgets)",
            "تصدير بيانات التنفيذات (CSV, JSON, Excel)",
            "مراقبة أداء المنافسين ومقارنة النمو",
          ].map((feature, i) => (
            <motion.div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + i * 0.02 }}>
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="text-slate-600" style={{ fontSize: "0.8125rem" }}>{feature}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
