import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import { getPlatformIcon, type PlatformType } from "./PlatformIcons";
import { useTheme } from "../context/ThemeContext";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  accountName: string;
  platformId: PlatformType;
  platformName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  accountName,
  platformId,
  platformName,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const { language, t } = useTheme();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
          style={{ zIndex: 110 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-white dark:bg-slate-800"
            style={{
              boxShadow: "0 25px 60px rgba(0,0,0,0.15), 0 0 40px rgba(239,68,68,0.08)",
            }}
            initial={{ scale: 0.8, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Red gradient bar */}
            <motion.div
              className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-pink-500"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6 }}
              style={{ transformOrigin: language === "ar" ? "right" : "left" }}
            />

            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600"
            >
              <X className="w-4 h-4 text-slate-500 dark:text-slate-300" />
            </button>

            <div className="p-6 sm:p-8 pt-12 text-center">
              {/* Warning Icon */}
              <motion.div
                className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center bg-red-50 border-2 border-red-200"
                animate={{
                  scale: [1, 1.05, 1],
                  borderColor: [
                    "rgba(239,68,68,0.2)",
                    "rgba(239,68,68,0.4)",
                    "rgba(239,68,68,0.2)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </motion.div>

              <h3 className="text-slate-800 dark:text-slate-100 mb-2">{t("حذف الحساب", "Delete Account")}</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-2" style={{ fontSize: "0.875rem" }}>
                {t("هل أنت متأكد من حذف هذا الحساب؟", "Are you sure you want to delete this account?")}
              </p>

              {/* Account Info */}
              <div
                className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 mb-4"
                style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                dir={language === "ar" ? "rtl" : "ltr"}
              >
                {getPlatformIcon(platformId, 20)}
                <div className="text-right">
                  <p className="text-slate-700 dark:text-slate-200" style={{ fontSize: "0.8125rem" }}>
                    {platformName}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400" style={{ fontSize: "0.75rem" }}>
                    {accountName}
                  </p>
                </div>
              </div>

              <p className="text-slate-400 dark:text-slate-500 mb-6" style={{ fontSize: "0.75rem" }}>
                {t(
                  "سيتم إلغاء ربط هذا الحساب ولن يكون متاحاً للنشر التلقائي",
                  "This account will be disconnected and unavailable for automation"
                )}
              </p>

              <div className="flex gap-3">
                <motion.button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {t("إلغاء", "Cancel")}
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                  style={{ boxShadow: "0 4px 15px rgba(239,68,68,0.3)" }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="w-4 h-4" />
                  {t("حذف", "Delete")}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
