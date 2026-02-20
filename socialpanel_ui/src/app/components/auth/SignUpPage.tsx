import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ArrowLeft,
  Shield,
  Loader2,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { SocialLoginButtons } from "./SocialLoginButtons";
import { AnimatedBackground } from "../AnimatedBackground";

export function SignUpPage() {
  const navigate = useNavigate();
  const { signup, socialLogin, isLoading, authError, clearAuthError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordStrength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "ضعيفة", "مقبولة", "جيدة", "قوية", "ممتازة"][passwordStrength];
  const strengthColor = ["", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-400", "bg-emerald-500"][passwordStrength];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "الاسم مطلوب";
    if (!email) errs.email = "البريد الإلكتروني مطلوب";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "بريد إلكتروني غير صالح";
    if (!password) errs.password = "كلمة المرور مطلوبة";
    else if (password.length < 6) errs.password = "6 أحرف على الأقل";
    if (password !== confirmPassword) errs.confirmPassword = "كلمتا المرور غير متطابقتين";
    if (!agreeTerms) errs.terms = "يجب الموافقة على الشروط";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    clearAuthError();
    const success = await signup(name, email, password);
    if (success) navigate("/verify-email", { state: { email } });
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
        className="fixed bottom-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", filter: "blur(80px)", zIndex: 0 }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo */}
        <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
            إنشاء حساب جديد
          </h1>
          <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
            انضم الآن وابدأ بإدارة حساباتك بذكاء
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="rounded-3xl bg-white/90 backdrop-blur-sm p-6 sm:p-8"
          style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <SocialLoginButtons onSocialLogin={handleSocialLogin} isLoading={isLoading} />

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-slate-400" style={{ fontSize: "0.8125rem" }}>أو بالبريد الإلكتروني</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>الاسم الكامل</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); clearAuthError(); }}
                  placeholder="أدخل اسمك"
                  className={`w-full py-3 pr-10 pl-4 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.name ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                />
              </div>
              {errors.name && <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.name}</motion.p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); clearAuthError(); }}
                  placeholder="your@email.com"
                  className={`w-full py-3 pr-10 pl-4 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.email ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                  dir="ltr"
                />
              </div>
              {errors.email && <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.email}</motion.p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); clearAuthError(); }}
                  placeholder="••••••••"
                  className={`w-full py-3 pr-10 pl-10 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.password ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= passwordStrength ? strengthColor : "bg-slate-200"} transition-colors`} />
                    ))}
                  </div>
                  <p className="text-slate-400" style={{ fontSize: "0.6875rem" }}>
                    قوة كلمة المرور: <span className={passwordStrength >= 4 ? "text-emerald-600" : passwordStrength >= 2 ? "text-amber-600" : "text-red-500"}>{strengthLabel}</span>
                  </p>
                </div>
              )}
              {errors.password && <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.password}</motion.p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-slate-600 mb-1.5" style={{ fontSize: "0.8125rem" }}>تأكيد كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); clearAuthError(); }}
                  placeholder="••••••••"
                  className={`w-full py-3 pr-10 pl-10 rounded-xl bg-slate-50 border text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    errors.confirmPassword ? "border-red-300 focus:ring-red-100" : "border-slate-200 focus:ring-violet-100 focus:border-violet-400"
                  }`}
                  style={{ fontSize: "0.875rem" }}
                  dir="ltr"
                />
                {confirmPassword && confirmPassword === password && (
                  <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                )}
              </div>
              {errors.confirmPassword && <motion.p className="text-red-500 mt-1" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{errors.confirmPassword}</motion.p>}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => { setAgreeTerms(e.target.checked); setErrors((p) => ({ ...p, terms: "" })); }}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-200"
              />
              <span className={`${errors.terms ? "text-red-500" : "text-slate-500"}`} style={{ fontSize: "0.8125rem" }}>
                أوافق على <button type="button" className="text-violet-600 hover:underline">شروط الاستخدام</button> و<button type="button" className="text-violet-600 hover:underline">سياسة الخصوصية</button>
              </span>
            </label>

            {authError ? (
              <motion.p className="text-red-500" style={{ fontSize: "0.75rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {authError}
              </motion.p>
            ) : null}

            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>إنشاء الحساب</span>
                  <ArrowLeft className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400" style={{ fontSize: "0.6875rem" }}>بياناتك محمية ومشفرة</span>
          </div>
        </motion.div>

        <motion.p className="text-center mt-6 text-slate-500" style={{ fontSize: "0.875rem" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          لديك حساب بالفعل؟{" "}
          <button onClick={() => navigate("/login")} className="text-violet-600 hover:text-violet-700 transition-colors">
            تسجيل الدخول
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
