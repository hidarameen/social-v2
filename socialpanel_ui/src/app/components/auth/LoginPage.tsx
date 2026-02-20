import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowLeft,
  Shield,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { AnimatedBackground } from "../AnimatedBackground";

const REMEMBER_EMAIL_KEY = "socialflow_auth_remember_email";
const REMEMBER_ENABLED_KEY = "socialflow_auth_remember_enabled";

function readRememberPreferences() {
  if (typeof window === "undefined") {
    return { rememberEnabled: false, rememberedEmail: "" };
  }
  try {
    return {
      rememberEnabled: window.localStorage.getItem(REMEMBER_ENABLED_KEY) === "1",
      rememberedEmail: window.localStorage.getItem(REMEMBER_EMAIL_KEY) || "",
    };
  } catch {
    return { rememberEnabled: false, rememberedEmail: "" };
  }
}

function writeRememberPreferences(rememberEnabled: boolean, email: string) {
  if (typeof window === "undefined") return;
  try {
    if (rememberEnabled) {
      const normalized = String(email || "").trim().toLowerCase();
      window.localStorage.setItem(REMEMBER_ENABLED_KEY, "1");
      if (normalized) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, normalized);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      return;
    }
    window.localStorage.removeItem(REMEMBER_ENABLED_KEY);
    window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
  } catch {
    // Ignore storage write failures.
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, socialLogin, isLoading, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState(() => {
    const { rememberEnabled, rememberedEmail } = readRememberPreferences();
    return rememberEnabled ? rememberedEmail : "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [rememberMe, setRememberMe] = useState(() => readRememberPreferences().rememberEnabled);

  useEffect(() => {
    writeRememberPreferences(rememberMe, email);
  }, [email, rememberMe]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!email) errs.email = "البريد الإلكتروني مطلوب";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "بريد إلكتروني غير صالح";
    if (!password) errs.password = "كلمة المرور مطلوبة";
    else if (password.length < 6) errs.password = "كلمة المرور قصيرة جداً";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    clearAuthError();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    writeRememberPreferences(rememberMe, normalizedEmail);
    const success = await login(normalizedEmail, password);
    if (success) navigate("/dashboard");
  };

  const handleSocialLogin = async (provider: "google" | "twitter" | "facebook") => {
    const success = await socialLogin(provider);
    if (success) navigate("/dashboard");
    return success;
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

      <div
        className="fixed top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)", filter: "blur(80px)", zIndex: 0 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
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
          <h1 className="text-slate-800 mb-1" style={{ fontFamily: "Cairo, sans-serif" }}>
            مرحباً بعودتك
          </h1>
          <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
            سجل دخولك للوصول إلى لوحة التحكم
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="rounded-3xl bg-white/90 backdrop-blur-sm p-6 sm:p-8"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Social Login */}
          <SocialLoginButtons onSocialLogin={handleSocialLogin} isLoading={isLoading} />

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-400" style={{ fontSize: "0.8125rem" }}>
              أو بالبريد الإلكتروني
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); clearAuthError(); }}
                  placeholder="your@email.com"
                  className={`w-full py-3 pr-10 pl-4 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.email ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                  dir="ltr"
                />
              </div>
              {errors.email && (
                <motion.p
                  className="text-red-500 mt-1"
                  style={{ fontSize: "0.75rem" }}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.email}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); clearAuthError(); }}
                  placeholder="••••••••"
                  className={`w-full py-3 pr-10 pl-10 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.password ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  className="text-red-500 mt-1"
                  style={{ fontSize: "0.75rem" }}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {errors.password}
                </motion.p>
              )}
            </div>

            {authError ? (
              <motion.p
                className="text-red-500"
                style={{ fontSize: "0.75rem" }}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {authError}
              </motion.p>
            ) : null}

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
                />
                <span className="text-slate-500" style={{ fontSize: "0.8125rem" }}>
                  تذكرني
                </span>
              </label>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="text-violet-600 hover:text-violet-700 transition-colors"
                style={{ fontSize: "0.8125rem" }}
              >
                نسيت كلمة المرور؟
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-2 relative overflow-hidden disabled:opacity-50"
              style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
              whileHover={{ scale: 1.01, boxShadow: "0 6px 25px rgba(15,23,42,0.3)" }}
              whileTap={{ scale: 0.99 }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Security */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
              اتصال آمن ومشفر بالكامل
            </span>
          </div>
        </motion.div>

        {/* Sign Up Link */}
        <motion.p
          className="text-center mt-6 text-slate-500"
          style={{ fontSize: "0.875rem" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          ليس لديك حساب؟{" "}
          <button
            onClick={() => navigate("/signup")}
            className="text-violet-600 hover:text-violet-700 transition-colors"
          >
            إنشاء حساب جديد
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
