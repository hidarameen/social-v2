import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AnimatedBackground } from "../AnimatedBackground";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { theme, language } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Page transition loading
  useEffect(() => {
    setPageLoading(true);
    const t = setTimeout(() => setPageLoading(false), 300);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!isAuthenticated) return null;

  return (
    <div
      className={`min-h-screen w-full relative flex ${theme === "dark" ? "dark" : ""}`}
      style={{
        background: theme === "dark"
          ? "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)"
          : "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
        fontFamily: language === "ar" ? "Cairo, Inter, sans-serif" : "Inter, sans-serif",
      }}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {theme === "light" && <AnimatedBackground />}
      <Toaster position="top-center" richColors theme={theme === "dark" ? "dark" : "light"} />

      {/* Ambient blobs */}
      <motion.div
        className="fixed top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: theme === "dark"
            ? "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
          zIndex: 0,
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="fixed bottom-[-200px] left-[-200px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: theme === "dark"
            ? "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)",
          filter: "blur(80px)",
          zIndex: 0,
        }}
        animate={{
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 relative z-10">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            {pageLoading ? (
              <motion.div
                key="loader"
                className="flex items-center justify-center min-h-[40vh]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex flex-col items-center gap-3"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
