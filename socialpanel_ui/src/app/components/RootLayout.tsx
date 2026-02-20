import { useState, useCallback } from "react";
import { Outlet } from "react-router";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { SplashScreen } from "./SplashScreen";
import { AnimatePresence, motion } from "motion/react";

export function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AnimatePresence>
          {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        </AnimatePresence>
        {!showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Outlet />
          </motion.div>
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}
