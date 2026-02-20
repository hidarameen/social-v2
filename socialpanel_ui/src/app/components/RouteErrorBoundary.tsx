import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { motion } from "motion/react";

function resolveMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    if (typeof error.data === "string" && error.data.trim()) return error.data;
    return error.statusText || "Unexpected route error.";
  }
  if (error instanceof Error) return error.message || "Unexpected application error.";
  return "Unexpected application error.";
}

export function RouteErrorBoundary() {
  const navigate = useNavigate();
  const error = useRouteError();
  const message = resolveMessage(error);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <motion.div
        className="w-full max-w-md rounded-3xl bg-white/90 backdrop-blur-sm p-6 text-center"
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 mx-auto mb-4 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-slate-800 mb-2" style={{ fontFamily: "Cairo, sans-serif" }}>
          حدث خطأ غير متوقع
        </h2>
        <p className="text-slate-500 mb-5" style={{ fontSize: "0.875rem", lineHeight: 1.6 }}>
          {message}
        </p>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-slate-800 text-white flex items-center gap-2"
            style={{ fontSize: "0.8125rem" }}
          >
            <RefreshCw className="w-4 h-4" />
            إعادة التحميل
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 flex items-center gap-2"
            style={{ fontSize: "0.8125rem" }}
          >
            <Home className="w-4 h-4" />
            الصفحة الرئيسية
          </button>
        </div>
      </motion.div>
    </div>
  );
}
