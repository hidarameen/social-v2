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
} from "lucide-react";

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
  return <PlaceholderPage icon={HelpCircle} title="المساعدة والدعم" description="الأسئلة الشائعة، دليل المستخدم، والتواصل مع فريق الدعم الفني." color="text-amber-600" bg="bg-amber-50" />;
}