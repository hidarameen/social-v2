import { useMemo } from "react";
import { motion } from "motion/react";
import { ExternalLink, Send } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export function ManualPublishPage() {
  const { t } = useTheme();

  const manualPublishUrl = useMemo(() => {
    if (typeof window === "undefined") return "/social-v2/index.html#/dashboard/tasks";
    return `${window.location.origin}/social-v2/index.html#/dashboard/tasks`;
  }, []);

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto rounded-2xl bg-white dark:bg-slate-800/50 p-6 sm:p-8"
      style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 mb-4">
        <Send className="w-4 h-4 text-violet-600" />
        <span className="text-violet-700" style={{ fontSize: "0.75rem" }}>
          {t("النشر اليدوي", "Manual Publish")}
        </span>
      </div>

      <h2 className="text-slate-800 dark:text-slate-100 mb-2" style={{ fontSize: "1.125rem" }}>
        {t("فتح صفحة النشر اليدوي", "Open Manual Publish")}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-5" style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>
        {t(
          "تم توحيد اللوحة. استخدم مسار المهام داخل اللوحة الموحدة لإدارة النشر.",
          "The panel is now unified. Use the tasks flow inside the unified panel for publishing operations."
        )}
      </p>

      <a
        href={manualPublishUrl}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 text-white"
        style={{ fontSize: "0.875rem", boxShadow: "0 4px 20px rgba(15,23,42,0.2)" }}
      >
        <ExternalLink className="w-4 h-4" />
        <span>{t("فتح المهام الموحدة", "Open Unified Tasks")}</span>
      </a>
    </motion.div>
  );
}
