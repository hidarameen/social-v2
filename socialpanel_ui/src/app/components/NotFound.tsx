import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Home, ArrowRight, Layers } from "lucide-react";
import { AnimatedBackground } from "./AnimatedBackground";
import { useTheme } from "../context/ThemeContext";

export function NotFound() {
  const navigate = useNavigate();
  const { language, t, theme } = useTheme();

  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center p-4"
      style={{
        background:
          theme === "dark"
            ? "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)"
            : "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
        fontFamily: language === "ar" ? "Cairo, Inter, sans-serif" : "Inter, sans-serif",
      }}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <AnimatedBackground />

      <motion.div
        className="relative z-10 text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center"
          style={{ boxShadow: "0 6px 20px rgba(139,92,246,0.3)" }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Layers className="w-8 h-8 text-white" />
        </motion.div>

        <motion.p
          className="text-slate-300 mb-2"
          style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "5rem", lineHeight: 1 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          404
        </motion.p>
        <h1 className="text-slate-800 dark:text-slate-200 mb-2" style={{ fontFamily: language === "ar" ? "Cairo, sans-serif" : "Inter, sans-serif" }}>
          {t("الصفحة غير موجودة", "Page Not Found")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8" style={{ fontSize: "0.9375rem" }}>
          {t("يبدو أن الصفحة التي تبحث عنها غير موجودة أو تم نقلها", "The page you are looking for does not exist or was moved")}
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <motion.button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-2xl bg-slate-800 text-white flex items-center gap-2"
            style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Home className="w-5 h-5" />
            <span>{t("الصفحة الرئيسية", "Home")}</span>
          </motion.button>
          <motion.button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2"
            style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <ArrowRight className={`w-5 h-5 ${language === "ar" ? "" : "rotate-180"}`} />
            <span>{t("العودة", "Back")}</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
