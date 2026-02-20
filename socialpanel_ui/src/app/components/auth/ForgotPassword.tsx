import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import {
  Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle, Shield,
  Lock, Eye, EyeOff, RefreshCw, KeyRound
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AnimatedBackground } from "../AnimatedBackground";

type Step = "email" | "code" | "newPassword" | "success";

export function ForgotPassword() {
  const navigate = useNavigate();
  const { resetPassword, completePasswordReset, isLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (step === "code") {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    if (!email) { setError("البريد الإلكتروني مطلوب"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("بريد إلكتروني غير صالح"); return; }
    const success = await resetPassword(email);
    if (success) {
      setStep("code");
      setResendTimer(60);
      setError("");
    } else {
      setError(authError || "تعذر إرسال رمز التحقق");
    }
  };

  const handleCodeChange = (index: number, value: string) => {
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
      handleVerifyCode(newCode.join(""));
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
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (_fullCode: string) => {
    await new Promise((r) => setTimeout(r, 1000));
    setStep("newPassword");
  };

  const handleResend = () => {
    clearAuthError();
    setResendTimer(60);
    setCode(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    if (!newPassword) { setError("كلمة المرور مطلوبة"); return; }
    if (newPassword.length < 8) { setError("يجب أن تكون 8 أحرف على الأقل"); return; }
    if (newPassword !== confirmPassword) { setError("كلمات المرور غير متطابقة"); return; }
    const success = await completePasswordReset(email, code.join(""), newPassword);
    if (!success) {
      setError(authError || "تعذر تحديث كلمة المرور");
      return;
    }
    setError("");
    setStep("success");
    setTimeout(() => navigate("/login"), 2500);
  };

  const getPasswordStrength = (pass: string) => {
    let s = 0;
    if (pass.length >= 8) s++;
    if (pass.length >= 12) s++;
    if (/[A-Z]/.test(pass)) s++;
    if (/[0-9]/.test(pass)) s++;
    if (/[^A-Za-z0-9]/.test(pass)) s++;
    return s;
  };

  const strength = getPasswordStrength(newPassword);
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-emerald-500"];
  const strengthLabels = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];

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
        {/* Logo */}
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <motion.div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center cursor-pointer relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              boxShadow: "0 6px 20px rgba(139,92,246,0.3)",
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
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

        {/* Steps indicator */}
        <motion.div className="flex items-center justify-center gap-2 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {["email", "code", "newPassword"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <motion.div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step === s || (step === "success" && i <= 2)
                    ? "bg-violet-600 text-white"
                    : ["email", "code", "newPassword"].indexOf(step) > i || step === "success"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-500"
                }`}
                style={{ fontSize: "0.75rem" }}
                animate={step === s ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {["email", "code", "newPassword"].indexOf(step) > i || step === "success" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </motion.div>
              {i < 2 && (
                <div className={`w-8 h-0.5 rounded-full ${["email", "code", "newPassword"].indexOf(step) > i || step === "success" ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </motion.div>

        <motion.div
          className="rounded-3xl bg-white/90 backdrop-blur-sm p-6 sm:p-8"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div key="email" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <motion.div
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center"
                    style={{ border: "2px solid rgba(245,158,11,0.2)" }}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Mail className="w-8 h-8 text-amber-600" />
                  </motion.div>
                  <h2 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>
                    نسيت كلمة المرور؟
                  </h2>
                  <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
                    أدخل بريدك الإلكتروني وسنرسل لك رمز التحقق
                  </p>
                </div>

                <form onSubmit={handleSubmitEmail} className="space-y-4">
                  <div>
                    <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        placeholder="your@email.com"
                        className={`w-full py-3 pr-10 pl-4 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                          error ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                        }`}
                        style={{ fontSize: "0.875rem" }}
                        dir="ltr"
                      />
                    </div>
                    {error && <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>إرسال رمز التحقق</span>
                        <ArrowLeft className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {step === "code" && (
              <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <motion.div
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-50 flex items-center justify-center"
                    style={{ border: "2px solid rgba(139,92,246,0.2)" }}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <KeyRound className="w-8 h-8 text-violet-600" />
                  </motion.div>
                  <h2 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>أدخل رمز التحقق</h2>
                  <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
                    تم إرسال رمز مكون من 6 أرقام إلى
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
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center rounded-xl bg-slate-50 border text-slate-800 focus:outline-none focus:ring-2 transition-all ${
                        error ? "border-red-300 focus:ring-red-100" : digit ? "border-violet-300 focus:ring-violet-100 focus:border-violet-400" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                      }`}
                      style={{ fontSize: "1.25rem", fontFamily: "Space Grotesk, sans-serif" }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    />
                  ))}
                </div>

                {error && (
                  <motion.p className="text-red-500 text-center mb-4" style={{ fontSize: "0.8125rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {error}
                  </motion.p>
                )}

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                    <span className="text-slate-500" style={{ fontSize: "0.8125rem" }}>جاري التحقق...</span>
                  </div>
                )}

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
            )}

            {step === "newPassword" && (
              <motion.div key="newPassword" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-6">
                  <motion.div
                    className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center"
                    style={{ border: "2px solid rgba(16,185,129,0.2)" }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring" }}
                  >
                    <Lock className="w-8 h-8 text-emerald-600" />
                  </motion.div>
                  <h2 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>كلمة مرور جديدة</h2>
                  <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>أدخل كلمة المرور الجديدة</p>
                </div>

                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <div>
                    <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>كلمة المرور الجديدة</label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                        placeholder="••••••••"
                        className="w-full py-3 pr-10 pl-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
                        style={{ fontSize: "0.875rem" }}
                        dir="ltr"
                      />
                      <button type="button" onClick={() => setShowNew(!showNew)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <motion.div className="mt-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                        <div className="flex gap-1 mb-1">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthColors[Math.min(strength - 1, 4)] : "bg-slate-200"}`} />
                          ))}
                        </div>
                        <p className="text-slate-500" style={{ fontSize: "0.6875rem" }}>{strengthLabels[Math.min(strength, 4)] || strengthLabels[0]}</p>
                      </motion.div>
                    )}
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>تأكيد كلمة المرور</label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                        placeholder="••••••••"
                        className="w-full py-3 pr-10 pl-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-400 transition-all"
                        style={{ fontSize: "0.875rem" }}
                        dir="ltr"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        كلمات المرور غير متطابقة
                      </motion.p>
                    )}
                  </div>

                  {error && <motion.p className="text-red-500" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>تعيين كلمة المرور الجديدة</span>
                        <ArrowLeft className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                <motion.div
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 flex items-center justify-center"
                  style={{ border: "2px solid rgba(16,185,129,0.2)" }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: 0.4 }}>
                    <CheckCircle className="w-10 h-10 text-emerald-500" />
                  </motion.div>
                </motion.div>

                <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>تم بنجاح!</h2>
                <p className="text-slate-500 mb-6" style={{ fontSize: "0.875rem" }}>
                  تم تغيير كلمة المرور بنجاح. سيتم توجيهك لصفحة تسجيل الدخول...
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
            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
              {step === "code" ? "رمز التحقق صالح لمدة 10 دقائق" : "اتصال آمن ومشفر بالكامل"}
            </span>
          </div>
        </motion.div>

        <motion.p className="text-center mt-6 text-slate-500" style={{ fontSize: "0.875rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <button onClick={() => navigate("/login")} className="text-violet-600 hover:text-violet-700 transition-colors flex items-center gap-1 mx-auto">
            <ArrowRight className="w-4 h-4" />
            العودة لتسجيل الدخول
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
