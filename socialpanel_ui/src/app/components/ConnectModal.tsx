import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Shield, CheckCircle, Loader2, ExternalLink, Zap } from "lucide-react";
import { getPlatformIcon, type PlatformInfo } from "./PlatformIcons";

interface ConnectModalProps {
  platform: PlatformInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onConnect: (platform: PlatformInfo, username: string) => void;
}

type Step = "info" | "connecting" | "auth" | "success";

export function ConnectModal({
  platform,
  isOpen,
  onClose,
  onConnect,
}: ConnectModalProps) {
  const [step, setStep] = useState<Step>("info");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setStep("info");
      setProgress(0);
    }
  }, [isOpen]);

  const handleConnect = () => {
    setStep("connecting");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    setTimeout(() => {
      setStep("auth");
    }, 1600);

    setTimeout(() => {
      setStep("success");
    }, 3200);

    setTimeout(() => {
      if (platform) {
        const usernames: Record<string, string> = {
          facebook: "BusinessPage",
          instagram: "@creative_studio",
          twitter: "@tech_brand",
          linkedin: "Company Profile",
          tiktok: "@viral_content",
          youtube: "Channel Pro",
          pinterest: "@design_pins",
          google_business: "My Business",
          threads: "@thread_master",
          snapchat: "@snap_brand",
          telegram: "@channel_bot",
          whatsapp: "+966 50 XXX XXXX",
        };
        onConnect(platform, usernames[platform.id] || "@user");
      }
    }, 4500);
  };

  if (!platform) return null;

  const getPermissions = () => {
    const base = [
      "قراءة معلومات الحساب",
      "نشر المحتوى نيابة عنك",
    ];
    if (platform.id === "telegram") {
      return [...base, "إدارة القنوات والمجموعات", "إرسال الرسائل عبر البوت"];
    }
    if (platform.id === "whatsapp") {
      return [...base, "إرسال رسائل عبر Business API", "إدارة جهات الاتصال"];
    }
    return [...base, "إدارة التعليقات والرسائل", "الوصول إلى التحليلات"];
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
          style={{ zIndex: 100 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md rounded-3xl overflow-hidden bg-white max-h-[90vh] overflow-y-auto"
            style={{
              boxShadow: `0 25px 60px rgba(0,0,0,0.15), 0 0 40px ${platform.bgGlow}`,
            }}
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Top Gradient Bar */}
            <motion.div
              className={`h-1.5 bg-gradient-to-r ${platform.gradient}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ transformOrigin: "left" }}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 z-10"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>

            <div className="p-6 sm:p-8 pt-12">
              <AnimatePresence mode="wait">
                {step === "info" && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center"
                  >
                    {/* Platform Icon */}
                    <motion.div
                      className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${platform.bgGlow}, rgba(248,250,252,0.8))`,
                        border: `1px solid ${platform.bgGlow}`,
                      }}
                      animate={{
                        boxShadow: [
                          `0 4px 15px ${platform.bgGlow}`,
                          `0 8px 30px ${platform.bgGlow}`,
                          `0 4px 15px ${platform.bgGlow}`,
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {getPlatformIcon(platform.id, 40)}
                    </motion.div>

                    <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      ربط حساب {platform.name}
                    </h2>
                    <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem" }}>
                      {platform.id === "telegram"
                        ? "سيتم ربط البوت مع قناتك أو مجموعتك"
                        : platform.id === "whatsapp"
                        ? "سيتم الربط عبر WhatsApp Business API"
                        : `سيتم توجيهك إلى ${platform.name} للمصادقة عبر OAuth 2.0`}
                    </p>

                    {/* Permissions */}
                    <div className="space-y-2.5 mb-6 text-right" dir="rtl">
                      {getPermissions().map((perm, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-50"
                          style={{ border: "1px solid rgba(0,0,0,0.05)" }}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * i }}
                        >
                          <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-slate-600" style={{ fontSize: "0.8125rem" }}>{perm}</span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Connect Button */}
                    <motion.button
                      onClick={handleConnect}
                      className="w-full py-3.5 rounded-2xl text-white relative overflow-hidden group"
                      style={{
                        background: platform.color === "#FFFC00" || platform.color === "#14171A"
                          ? "#1e293b"
                          : platform.color,
                        boxShadow: `0 4px 20px ${platform.bgGlow}`,
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <ExternalLink className="w-5 h-5" />
                        {platform.id === "telegram" ? "ربط البوت" : platform.id === "whatsapp" ? "ربط عبر API" : "ربط عبر OAuth"}
                      </span>
                      <motion.div
                        className="absolute inset-0 bg-white/10"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.6 }}
                      />
                    </motion.button>

                    <p className="mt-4 text-slate-400 flex items-center justify-center gap-1" style={{ fontSize: "0.75rem" }}>
                      <Shield className="w-3 h-3" />
                      اتصال آمن ومشفر
                    </p>
                  </motion.div>
                )}

                {step === "connecting" && (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-slate-50"
                      style={{ border: "2px solid rgba(0,0,0,0.08)" }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="w-8 h-8 text-slate-600" />
                    </motion.div>

                    <h3 className="text-slate-800 mb-2">جاري الاتصال...</h3>
                    <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem" }}>
                      يتم إنشاء اتصال آمن مع {platform.name}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full bg-gradient-to-r ${platform.gradient}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <p className="mt-2 text-slate-400" style={{ fontSize: "0.75rem" }}>
                      {Math.min(progress, 100)}%
                    </p>
                  </motion.div>
                )}

                {step === "auth" && (
                  <motion.div
                    key="auth"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-amber-50 border-2 border-amber-200"
                      animate={{
                        scale: [1, 1.05, 1],
                        borderColor: [
                          "rgba(245,158,11,0.3)",
                          "rgba(245,158,11,0.6)",
                          "rgba(245,158,11,0.3)",
                        ],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Zap className="w-8 h-8 text-amber-600" />
                    </motion.div>

                    <h3 className="text-slate-800 mb-2">المصادقة</h3>
                    <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
                      يتم التحقق من صلاحيات الوصول...
                    </p>

                    <div className="mt-6 flex justify-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-amber-500"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-emerald-50 border-2 border-emerald-200"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                    >
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", delay: 0.4 }}
                      >
                        <CheckCircle className="w-10 h-10 text-emerald-500" />
                      </motion.div>
                    </motion.div>

                    <motion.h3
                      className="text-slate-800 mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      تم الربط بنجاح!
                    </motion.h3>
                    <motion.p
                      className="text-slate-500"
                      style={{ fontSize: "0.875rem" }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                    >
                      تم ربط حساب {platform.name} بنجاح
                    </motion.p>

                    {/* Success particles */}
                    {[...Array(8)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400"
                        style={{
                          left: "50%",
                          top: "40%",
                        }}
                        initial={{ x: 0, y: 0, opacity: 1 }}
                        animate={{
                          x: Math.cos((i / 8) * Math.PI * 2) * 80,
                          y: Math.sin((i / 8) * Math.PI * 2) * 80,
                          opacity: 0,
                          scale: 0,
                        }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
