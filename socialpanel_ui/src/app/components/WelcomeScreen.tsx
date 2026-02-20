import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Zap,
  Shield,
  BarChart3,
  Globe,
  Clock,
  Sparkles,
  ChevronLeft,
  Users,
  TrendingUp,
} from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  YouTubeIcon,
  TikTokIcon,
  LinkedInIcon,
  TelegramIcon,
  WhatsAppIcon,
} from "./PlatformIcons";

export function WelcomeScreen() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Globe,
      title: "12 منصة مدعومة",
      desc: "ادعم جميع منصات التواصل الاجتماعي من مكان واحد",
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      icon: Clock,
      title: "جدولة تلقائية",
      desc: "انشر محتواك تلقائياً في أفضل الأوقات",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: BarChart3,
      title: "تحليلات متقدمة",
      desc: "تتبع أداء حساباتك بتقارير مفصلة وبيانات حية",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Shield,
      title: "أمان OAuth 2.0",
      desc: "حماية كاملة لبياناتك عبر بروتوكولات مشفرة",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: Users,
      title: "إدارة الفريق",
      desc: "تعاون مع فريقك بصلاحيات مخصصة لكل عضو",
      color: "text-rose-600",
      bg: "bg-rose-50",
    },
    {
      icon: TrendingUp,
      title: "تحسين النمو",
      desc: "اقتراحات ذكية لزيادة تفاعل ومتابعي حساباتك",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
  ];

  const stats = [
    { value: "50K+", label: "مستخدم نشط" },
    { value: "12", label: "منصة مدعومة" },
    { value: "99.9%", label: "وقت التشغيل" },
    { value: "2M+", label: "منشور مجدول" },
  ];

  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AnimatedBackground />

      {/* Ambient blobs */}
      <div
        className="fixed top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)", filter: "blur(80px)", zIndex: 0 }}
      />
      <div
        className="fixed bottom-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", filter: "blur(80px)", zIndex: 0 }}
      />

      {/* Navigation */}
      <motion.nav
        className="relative z-20 px-4 sm:px-8 py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 15px rgba(139,92,246,0.3)",
              }}
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
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
            <span className="text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "1.25rem" }}>
              SocialHub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => navigate("/login")}
              className="px-5 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-white/60 transition-all"
              style={{ fontSize: "0.875rem" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              تسجيل الدخول
            </motion.button>
            <motion.button
              onClick={() => navigate("/signup")}
              className="px-5 py-2.5 rounded-xl bg-slate-800 text-white"
              style={{ fontSize: "0.875rem", boxShadow: "0 4px 15px rgba(15,23,42,0.2)" }}
              whileHover={{ scale: 1.02, boxShadow: "0 6px 20px rgba(15,23,42,0.3)" }}
              whileTap={{ scale: 0.98 }}
            >
              ابدأ مجاناً
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-16 pb-12">
        <div className="text-center max-w-3xl mx-auto">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm mb-6"
            style={{ border: "1px solid rgba(139,92,246,0.15)", boxShadow: "0 2px 10px rgba(139,92,246,0.06)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-violet-600" />
            <span className="text-violet-700" style={{ fontSize: "0.8125rem" }}>
              منصة إدارة التواصل الاجتماعي الأذكى
            </span>
          </motion.div>

          <motion.h1
            className="text-slate-800 mb-4"
            style={{ fontFamily: "Cairo, sans-serif", fontSize: "clamp(1.75rem, 5vw, 3rem)", lineHeight: 1.3 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            أدر جميع حسااتك من{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #7c3aed, #3b82f6, #06b6d4)" }}
            >
              مكان واحد
            </span>
          </motion.h1>

          <motion.p
            className="text-slate-500 mb-8 max-w-xl mx-auto"
            style={{ fontSize: "1.0625rem", lineHeight: 1.7 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            اربط حساباتك، جدول منشوراتك، وتتبع أداءك على جميع منصات التواصل الاجتماعي بسهولة وأمان
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-3 mb-12 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.button
              onClick={() => navigate("/signup")}
              className="px-8 py-3.5 rounded-2xl bg-slate-800 text-white flex items-center gap-2"
              style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
              whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(15,23,42,0.35)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span>ابدأ مجاناً</span>
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={() => navigate("/login")}
              className="px-8 py-3.5 rounded-2xl bg-white text-slate-700 flex items-center gap-2"
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
              whileHover={{ scale: 1.03, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span>لديك حساب؟ سجل دخول</span>
            </motion.button>
          </motion.div>

          {/* Platform Icons Row */}
          <motion.div
            className="flex items-center justify-center gap-3 flex-wrap mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-slate-400" style={{ fontSize: "0.8125rem" }}>يدعم:</span>
            {[FacebookIcon, InstagramIcon, TwitterIcon, YouTubeIcon, TikTokIcon, LinkedInIcon, TelegramIcon, WhatsAppIcon].map(
              (Icon, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.05 }}
                  whileHover={{ scale: 1.2, y: -3 }}
                  className="cursor-pointer"
                >
                  <Icon size={28} />
                </motion.div>
              )
            )}
            <span className="text-slate-400" style={{ fontSize: "0.75rem" }}>+4 أخرى</span>
          </motion.div>
        </div>

        {/* Stats Row */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              className="text-center py-5 px-4 rounded-2xl bg-white/70 backdrop-blur-sm"
              style={{
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.08 }}
              whileHover={{ scale: 1.03, y: -2 }}
            >
              <p
                className="text-slate-800 mb-1"
                style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "1.5rem" }}
              >
                {stat.value}
              </p>
              <p className="text-slate-500" style={{ fontSize: "0.8125rem" }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <div className="text-center mb-10">
            <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>
              كل ما تحتاجه في منصة واحدة
            </h2>
            <p className="text-slate-500" style={{ fontSize: "0.9375rem" }}>
              أدوات متكاملة لإدارة حضورك الرقمي بكفاءة عالية
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm group"
                style={{
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 + i * 0.08 }}
                whileHover={{
                  scale: 1.02,
                  y: -3,
                  boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
                }}
              >
                <div className={`w-11 h-11 rounded-xl ${feature.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-slate-800 mb-1" style={{ fontSize: "0.9375rem" }}>
                  {feature.title}
                </h3>
                <p className="text-slate-500" style={{ fontSize: "0.8125rem", lineHeight: 1.6 }}>
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          className="max-w-2xl mx-auto mt-16 text-center p-8 sm:p-12 rounded-3xl bg-white/70 backdrop-blur-sm"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          <Zap className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>
            جاهز للبدء؟
          </h2>
          <p className="text-slate-500 mb-6" style={{ fontSize: "0.9375rem" }}>
            أنشئ حسابك المجاني الآن وابدأ بإدارة حساباتك بذكاء
          </p>
          <motion.button
            onClick={() => navigate("/signup")}
            className="px-10 py-3.5 rounded-2xl bg-slate-800 text-white inline-flex items-center gap-2"
            style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>إنشاء حساب مجاني</span>
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="mt-12 text-center pb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
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
              جميع البيانات مشفرة ومحمية وفق أعلى معايير الأمان
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}