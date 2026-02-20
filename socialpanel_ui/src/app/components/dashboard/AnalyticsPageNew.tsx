import { useState } from "react";
import { motion } from "motion/react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Eye, Heart, MessageSquare,
  Share2, Users, BarChart3, Globe, Zap, Target, Activity, PieChart as PieIcon,
  Calendar,
} from "lucide-react";
import { getPlatformIcon, type PlatformType } from "../PlatformIcons";

const weeklyData = [
  { day: "السبت", followers: 120, engagement: 340, posts: 5, reach: 2400 },
  { day: "الأحد", followers: 180, engagement: 420, posts: 8, reach: 3100 },
  { day: "الاثنين", followers: 90, engagement: 280, posts: 3, reach: 1800 },
  { day: "الثلاثاء", followers: 250, engagement: 520, posts: 10, reach: 4200 },
  { day: "الأربعاء", followers: 200, engagement: 480, posts: 7, reach: 3600 },
  { day: "الخميس", followers: 310, engagement: 680, posts: 12, reach: 5100 },
  { day: "الجمعة", followers: 270, engagement: 590, posts: 9, reach: 4500 },
];

const platformData = [
  { name: "Instagram", value: 45200, color: "#E4405F", growth: 12.5 },
  { name: "Facebook", value: 12500, color: "#1877F2", growth: 3.2 },
  { name: "X", value: 8100, color: "#14171A", growth: -2.1 },
  { name: "YouTube", value: 5400, color: "#FF0000", growth: 8.7 },
  { name: "TikTok", value: 3200, color: "#EE1D52", growth: 25.3 },
  { name: "LinkedIn", value: 2100, color: "#0A66C2", growth: 5.1 },
];

const engagementBreakdown = [
  { name: "إعجابات", value: 42, color: "#ef4444" },
  { name: "تعليقات", value: 28, color: "#3b82f6" },
  { name: "مشاركات", value: 18, color: "#8b5cf6" },
  { name: "حفظ", value: 12, color: "#10b981" },
];

const topPosts = [
  { platform: "instagram" as PlatformType, title: "تصميم هوية بصرية", engagement: "2.4K", reach: "12.5K", type: "صورة" },
  { platform: "youtube" as PlatformType, title: "دليل التسويق الرقمي", engagement: "1.8K", reach: "8.2K", type: "فيديو" },
  { platform: "twitter" as PlatformType, title: "نصائح للمبتدئين", engagement: "980", reach: "5.1K", type: "تغريدة" },
  { platform: "tiktok" as PlatformType, title: "خلف الكواليس", engagement: "3.1K", reach: "18.7K", type: "فيديو" },
  { platform: "facebook" as PlatformType, title: "إطلاق المنتج الجديد", engagement: "890", reach: "6.3K", type: "منشور" },
];

const hourlyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  activity: Math.floor(Math.random() * 100 + (i >= 9 && i <= 21 ? 50 : 0)),
}));

type TimeRange = "7d" | "30d" | "90d";

export function AnalyticsPageNew() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const kpiCards = [
    { icon: Users, label: "إجمالي المتابعين", value: "76.5K", change: "+2.8K", up: true, color: "text-violet-600", bg: "bg-violet-50", gradient: "from-violet-500 to-purple-600" },
    { icon: Eye, label: "الوصول", value: "245K", change: "+18%", up: true, color: "text-blue-600", bg: "bg-blue-50", gradient: "from-blue-500 to-cyan-500" },
    { icon: Heart, label: "التفاعل", value: "3.31K", change: "+12%", up: true, color: "text-rose-600", bg: "bg-rose-50", gradient: "from-rose-500 to-pink-500" },
    { icon: Share2, label: "المشاركات", value: "1.2K", change: "-3%", up: false, color: "text-amber-600", bg: "bg-amber-50", gradient: "from-amber-500 to-orange-500" },
    { icon: MessageSquare, label: "التعليقات", value: "856", change: "+22%", up: true, color: "text-emerald-600", bg: "bg-emerald-50", gradient: "from-emerald-500 to-teal-500" },
    { icon: Target, label: "نسبة التحويل", value: "4.7%", change: "+0.8%", up: true, color: "text-cyan-600", bg: "bg-cyan-50", gradient: "from-cyan-500 to-blue-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="px-3 py-1 rounded-full bg-white" style={{ border: "1px solid rgba(59,130,246,0.15)" }}>
              <span className="text-blue-700" style={{ fontSize: "0.75rem" }}>التحليلات المتقدمة</span>
            </div>
          </div>
          <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>تحليلات الأداء</h2>
          <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>نظرة شاملة على أداء حساباتك عبر جميع المنصات</p>
        </div>
        <div className="flex items-center rounded-xl bg-white overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
          {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
            <button key={r} onClick={() => setTimeRange(r)} className={`px-4 py-2.5 transition-all ${timeRange === r ? "bg-slate-800 text-white rounded-xl" : "text-slate-500 hover:bg-slate-50"}`} style={{ fontSize: "0.8125rem" }}>
              {r === "7d" ? "7 أيام" : r === "30d" ? "30 يوم" : "90 يوم"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((kpi, i) => (
          <motion.div key={i} className="p-4 rounded-2xl bg-white relative overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ scale: 1.03, y: -3 }}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className={`flex items-center gap-0.5 ${kpi.up ? "text-emerald-600" : "text-red-500"}`} style={{ fontSize: "0.5625rem" }}>
                {kpi.up ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                {kpi.change}
              </div>
            </div>
            <p className="text-slate-800" style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk" }}>{kpi.value}</p>
            <p className="text-slate-400" style={{ fontSize: "0.625rem" }}>{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Area Chart */}
        <motion.div className="lg:col-span-2 p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>نمو المتابعين والتفاعل</h3>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="gradFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 15px rgba(0,0,0,0.08)", fontSize: 12 }} />
              <Area type="monotone" dataKey="followers" stroke="#8b5cf6" fill="url(#gradFollowers)" strokeWidth={2} name="متابعين" />
              <Area type="monotone" dataKey="engagement" stroke="#3b82f6" fill="url(#gradEngagement)" strokeWidth={2} name="تفاعل" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>توزيع التفاعل</h3>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={engagementBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                {engagementBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {engagementBreakdown.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600" style={{ fontSize: "0.6875rem" }}>{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform Distribution */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>المتابعين حسب المنصة</h3>
            <Globe className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={platformData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={80} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} name="متابعين">
                {platformData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Activity Heatmap-style */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>نشاط الساعات</h3>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              <Line type="monotone" dataKey="activity" stroke="#8b5cf6" strokeWidth={2} dot={false} name="النشاط" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Platform Growth & Top Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform growth */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <h3 className="text-slate-800 mb-4" style={{ fontSize: "0.9375rem" }}>نمو المنصات</h3>
          <div className="space-y-3">
            {platformData.map((p, i) => (
              <motion.div key={i} className="flex items-center gap-3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.05 }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.color}15` }}>
                  {getPlatformIcon(["instagram", "facebook", "twitter", "youtube", "tiktok", "linkedin"][i] as PlatformType, 18)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-700" style={{ fontSize: "0.8125rem" }}>{p.name}</span>
                    <div className={`flex items-center gap-0.5 ${p.growth >= 0 ? "text-emerald-600" : "text-red-500"}`} style={{ fontSize: "0.6875rem" }}>
                      {p.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {p.growth >= 0 ? "+" : ""}{p.growth}%
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: p.color }} initial={{ width: 0 }} animate={{ width: `${(p.value / 45200) * 100}%` }} transition={{ duration: 0.8, delay: 0.9 + i * 0.1 }} />
                  </div>
                  <p className="text-slate-400 mt-0.5" style={{ fontSize: "0.625rem" }}>{p.value.toLocaleString()} متابع</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Top posts */}
        <motion.div className="p-5 rounded-2xl bg-white" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-800" style={{ fontSize: "0.9375rem" }}>أفضل المنشورات أداءً</h3>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-2">
            {topPosts.map((post, i) => (
              <motion.div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.05 }}>
                <div className="flex items-center justify-center w-8 h-8 shrink-0">
                  {getPlatformIcon(post.platform, 22)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 truncate" style={{ fontSize: "0.8125rem" }}>{post.title}</p>
                  <p className="text-slate-400" style={{ fontSize: "0.625rem" }}>{post.type}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-slate-700 flex items-center gap-1" style={{ fontSize: "0.75rem" }}><Heart className="w-3 h-3 text-rose-400" /> {post.engagement}</p>
                  <p className="text-slate-400 flex items-center gap-1" style={{ fontSize: "0.625rem" }}><Eye className="w-3 h-3" /> {post.reach}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}