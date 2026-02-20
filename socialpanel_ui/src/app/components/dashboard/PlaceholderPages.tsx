import { motion } from "motion/react";
import {
  BarChart3,
  Calendar,
  FileText,
  MessageSquare,
  Bell,
  Palette,
  Settings,
  HelpCircle,
  Sparkles,
  Construction,
  ExternalLink,
  Mail,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router";

interface PlaceholderProps {
  icon: typeof BarChart3;
  title: string;
  description: string;
  color: string;
  bg: string;
}

function PlaceholderPage({ icon: Icon, title, description, color, bg }: PlaceholderProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className={`w-20 h-20 mx-auto mb-6 rounded-2xl ${bg} flex items-center justify-center`}
          animate={{ scale: [1, 1.03, 1], boxShadow: ["0 0 20px rgba(0,0,0,0.04)", "0 0 30px rgba(0,0,0,0.08)", "0 0 20px rgba(0,0,0,0.04)"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Icon className={`w-10 h-10 ${color}`} />
        </motion.div>
        <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>{title}</h2>
        <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>{description}</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50" style={{ border: "1px solid rgba(245,158,11,0.15)" }}>
          <Construction className="w-4 h-4 text-amber-600" />
          <span className="text-amber-700" style={{ fontSize: "0.8125rem" }}>قيد التطوير - قريباً</span>
        </div>
      </motion.div>
    </div>
  );
}

export function AnalyticsPage() {
  return <PlaceholderPage icon={BarChart3} title="التحليلات والتقارير" description="تتبع أداء حساباتك عبر جميع المنصات مع تقارير مفصلة ورسوم بيانية تفاعلية. بيانات حية عن المتابعين والتفاعل والوصول." color="text-blue-600" bg="bg-blue-50" />;
}

export function SchedulePage() {
  return <PlaceholderPage icon={Calendar} title="جدولة المنشورات" description="جدول منشوراتك مسبقاً على جميع المنصات. تقويم تفاعلي بالسحب والإفلات مع اقتراحات ذكية لأفضل أوقات النشر." color="text-violet-600" bg="bg-violet-50" />;
}

export function ContentPage() {
  return <PlaceholderPage icon={FileText} title="إدارة المحتوى" description="أنشئ وأدر محتواك بسهولة. مكتبة وسائط مشتركة، قوالب جاهزة، وتكامل مع أدوات التصميم." color="text-emerald-600" bg="bg-emerald-50" />;
}

export function MessagesPage() {
  return <PlaceholderPage icon={MessageSquare} title="صندوق الرسائل الموحد" description="جميع رسائلك من كل المنصات في مكان واحد. رد سريع، ردود تلقائية ذكية، وتصنيف الرسائل." color="text-cyan-600" bg="bg-cyan-50" />;
}

export function NotificationsPage() {
  return <PlaceholderPage icon={Bell} title="مركز الإشعارات" description="تنبيهات فورية عن نشاط حساباتك. إشعارات التفاعل، انتهاء الربط، والتقارير الجاهزة." color="text-rose-600" bg="bg-rose-50" />;
}

export function ThemesPage() {
  return <PlaceholderPage icon={Palette} title="تخصيص المظهر" description="غيّر ألوان وشكل التطبيق حسب ذوقك. الوضع الليلي، ألوان مخصصة، وتخطيطات متعددة." color="text-purple-600" bg="bg-purple-50" />;
}

export function SettingsPage() {
  return <PlaceholderPage icon={Settings} title="إعدادات الحساب" description="تخصيص حسابك، إدارة الفريق، إعدادات الأمان، وتفضيلات الإشعارات." color="text-slate-600" bg="bg-slate-100" />;
}

export function HelpPage() {
  const navigate = useNavigate();
  const faqs = [
    {
      q: "كيف أربط حساب منصة جديدة؟",
      a: "انتقل إلى لوحة الحسابات ثم اختر إضافة حساب جديد. أكمل OAuth أو أدخل المفاتيح المطلوبة حسب المنصة.",
    },
    {
      q: "لماذا لا تعمل مهمة أتمتة جديدة؟",
      a: "تأكد أن المهمة تحتوي على مصدر واحد على الأقل وهدف واحد على الأقل، وأن الحسابات فعالة وغير منتهية الصلاحية.",
    },
    {
      q: "كيف أحدث مفاتيح API؟",
      a: "من الإعدادات > مفاتيح المنصات، حدّث القيم ثم اضغط حفظ. التغييرات تُطبق مباشرة على الحسابات الجديدة.",
    },
    {
      q: "كيف أفعّل Outstand API؟",
      a: "من الإعدادات أدخل Outstand API Key وحدد المنصات التي ستستخدم Outstand على مستوى المستخدم بالكامل.",
    },
  ];

  return (
    <div className="space-y-5">
      <motion.div
        className="rounded-2xl bg-white p-5 sm:p-6"
        style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 mb-3" style={{ border: "1px solid rgba(245,158,11,0.2)" }}>
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700" style={{ fontSize: "0.75rem" }}>Help Center</span>
            </div>
            <h2 className="text-slate-800" style={{ fontFamily: "Cairo, sans-serif" }}>المساعدة والدعم</h2>
            <p className="text-slate-500 mt-1" style={{ fontSize: "0.875rem" }}>
              إجابات سريعة لأكثر الأسئلة شيوعاً مع روابط مباشرة لحل المشاكل.
            </p>
          </div>
          <motion.button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 inline-flex items-center gap-2"
            style={{ fontSize: "0.8125rem" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث الصفحة</span>
          </motion.button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.button
          onClick={() => navigate("/dashboard/accounts")}
          className="text-right rounded-2xl bg-white p-4"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          whileHover={{ y: -2 }}
        >
          <MessageCircle className="w-5 h-5 text-violet-600 mb-2" />
          <p className="text-slate-800" style={{ fontSize: "0.875rem" }}>إدارة الحسابات</p>
          <p className="text-slate-500 mt-1" style={{ fontSize: "0.75rem" }}>ربط المنصات وإصلاح صلاحيات OAuth</p>
        </motion.button>

        <motion.button
          onClick={() => navigate("/dashboard/settings")}
          className="text-right rounded-2xl bg-white p-4"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -2 }}
        >
          <Settings className="w-5 h-5 text-blue-600 mb-2" />
          <p className="text-slate-800" style={{ fontSize: "0.875rem" }}>إعدادات ومفاتيح API</p>
          <p className="text-slate-500 mt-1" style={{ fontSize: "0.75rem" }}>تحديث مفاتيح المنصات وOutstand</p>
        </motion.button>

        <a
          href="mailto:support@socialflow.app"
          className="text-right rounded-2xl bg-white p-4 block"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <Mail className="w-5 h-5 text-emerald-600 mb-2" />
          <p className="text-slate-800" style={{ fontSize: "0.875rem" }}>تواصل مع الدعم</p>
          <p className="text-slate-500 mt-1" style={{ fontSize: "0.75rem" }}>support@socialflow.app</p>
        </a>
      </div>

      <motion.div
        className="rounded-2xl bg-white p-5 sm:p-6"
        style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h3 className="text-slate-800 mb-3" style={{ fontSize: "0.9375rem" }}>الأسئلة الشائعة</h3>
        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <div key={idx} className="rounded-xl bg-slate-50 p-4" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
              <p className="text-slate-800" style={{ fontSize: "0.8125rem" }}>{item.q}</p>
              <p className="text-slate-500 mt-1" style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        className="rounded-2xl bg-white p-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-slate-500" style={{ fontSize: "0.75rem" }}>
          للاطلاع على وثائق Next.js أو إعدادات OAuth المتقدمة استخدم الروابط الرسمية.
        </p>
        <a
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-violet-600 hover:text-violet-700"
          style={{ fontSize: "0.8125rem" }}
        >
          <span>Open Docs</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </motion.div>
    </div>
  );
}
