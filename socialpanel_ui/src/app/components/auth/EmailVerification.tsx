import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, useLocation } from "react-router";
import { Mail, CheckCircle, Loader2, RefreshCw, Shield, Layers } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AnimatedBackground } from "../AnimatedBackground";

export function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, isLoading, authError, clearAuthError } = useAuth();
  const email = (location.state as any)?.email || "your@email.com";
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError("");
    clearAuthError();

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((d) => d) && newCode.join("").length === 6) {
      handleVerify(newCode.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split("");
      setCode(newCode);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (fullCode: string) => {
    const success = await verifyEmail(fullCode, email);
    if (success) {
      setVerified(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } else {
      setError(authError || "رمز التحقق غير صحيح");
    }
  };

  const handleResend = () => {
    setResendTimer(60);
    setCode(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <AnimatedBackground />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div className="text-center mb-8">
          <motion.div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center cursor-pointer relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 6px 20px rgba(139,92,246,0.3)",
            }}
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate("/")}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
              }}
              animate={{ x: ["-200%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path d="M24 6L38 14V30L24 38L10 30V14L24 6Z" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M24 14L31 18V26L24 30L17 26V18L24 14Z" fill="white" fillOpacity="0.9" />
            </svg>
          </motion.div>
        </motion.div>

        <motion.div
          className="rounded-3xl bg-white/90 backdrop-blur-sm p-6 sm:p-8"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {!verified ? (
              <motion.div key="verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-center mb-6">
                  <motion.div
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-50 flex items-center justify-center"
                    style={{ border: "2px solid rgba(139,92,246,0.2)" }}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Mail className="w-8 h-8 text-violet-600" />
                  </motion.div>
                  <h2 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>
                    تحقق من بريدك الإلكتروني
                  </h2>
                  <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
                    أدخل الرمز المكون من 6 أرقام المرسل إلى
                  </p>
                  <p className="text-violet-600 mt-1" style={{ fontSize: "0.875rem", direction: "ltr" }}>{email}</p>
                </div>

                {/* OTP Inputs */}
                <div className="flex gap-2 sm:gap-3 justify-center mb-4" dir="ltr" onPaste={handlePaste}>
                  {code.map((digit, i) => (
                    <motion.input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center rounded-xl bg-slate-50 border text-slate-800 focus:outline-none focus:ring-2 transition-all ${
                        error ? "border-red-300 focus:ring-red-100" : digit ? "border-violet-300 focus:ring-violet-100 focus:border-violet-400" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                      }`}
                      style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk, sans-serif" }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    />
                  ))}
                </div>

                {error && (
                  <motion.p className="text-red-500 text-center mb-4" style={{ fontSize: "0.8125rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {error}
                  </motion.p>
                )}
                {!error && authError ? (
                  <motion.p className="text-red-500 text-center mb-4" style={{ fontSize: "0.8125rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {authError}
                  </motion.p>
                ) : null}

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                    <span className="text-slate-500" style={{ fontSize: "0.8125rem" }}>جاري التحقق...</span>
                  </div>
                )}

                {/* Resend */}
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-slate-400" style={{ fontSize: "0.8125rem" }}>
                      إعادة الإرسال بعد <span className="text-violet-600">{resendTimer}</span> ثانية
                    </p>
                  ) : (
                    <motion.button
                      onClick={handleResend}
                      className="text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-1.5 mx-auto"
                      style={{ fontSize: "0.8125rem" }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      إعادة إرسال الرمز
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center"
                  style={{ border: "2px solid rgba(16,185,129,0.2)" }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                >
                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.3 }}>
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </motion.div>
                </motion.div>
                <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>تم التحقق بنجاح!</h2>
                <p className="text-slate-500 mb-4" style={{ fontSize: "0.875rem" }}>
                  سيتم توجيهك للوحة التحكم...
                </p>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-emerald-500"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>رمز التحقق صالح لمدة 10 دقائق</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
