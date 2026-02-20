import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2000);
    const t4 = setTimeout(() => onComplete(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase < 3 && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: "linear-gradient(145deg, #eef0f5 0%, #e8eaf2 30%, #f0f1f6 50%, #e6e9f0 70%, #eef0f5 100%)",
            zIndex: 9999,
          }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {/* Animated Ambient Orbs */}
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
            animate={{
              x: ["-10%", "10%", "-5%"],
              y: ["-5%", "8%", "-3%"],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
              filter: "blur(50px)",
              right: "20%",
              bottom: "30%",
            }}
            animate={{
              x: ["5%", "-8%", "3%"],
              y: ["3%", "-6%", "2%"],
              scale: [1, 1.15, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Logo */}
            <motion.div
              className="relative"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
            >
              <motion.div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)",
                  boxShadow: "0 20px 60px rgba(124,58,237,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset",
                }}
                animate={phase >= 1 ? {
                  boxShadow: [
                    "0 20px 60px rgba(124,58,237,0.35)",
                    "0 25px 70px rgba(124,58,237,0.5)",
                    "0 20px 60px rgba(124,58,237,0.35)",
                  ],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                  }}
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
                {/* Logo SVG */}
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <motion.path
                    d="M24 6L38 14V30L24 38L10 30V14L24 6Z"
                    stroke="white"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.5 }}
                  />
                  <motion.path
                    d="M24 14L31 18V26L24 30L17 26V18L24 14Z"
                    fill="white"
                    fillOpacity="0.9"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  />
                  <motion.circle
                    cx="24" cy="22" r="3"
                    fill="rgba(124,58,237,0.8)"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.3, type: "spring" }}
                  />
                </svg>
              </motion.div>

              {/* Pulse rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-3xl"
                  style={{ border: "2px solid rgba(124,58,237,0.2)" }}
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: [1, 1.5 + i * 0.2], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                />
              ))}
            </motion.div>

            {/* Brand Name */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={phase >= 1 ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <h1
                className="text-slate-800 mb-1"
                style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "1.75rem", letterSpacing: "-0.02em" }}
              >
                SocialHub
              </h1>
              <motion.p
                className="text-slate-500"
                style={{ fontSize: "0.875rem", fontFamily: "Cairo, sans-serif" }}
                initial={{ opacity: 0 }}
                animate={phase >= 1 ? { opacity: 1 } : {}}
                transition={{ delay: 0.3 }}
              >
                منصة إدارة التواصل الاجتماعي الذكية
              </motion.p>
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              className="mt-10 flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 1 } : {}}
            >
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Version */}
            <motion.p
              className="mt-6 text-slate-400"
              style={{ fontSize: "0.6875rem" }}
              initial={{ opacity: 0 }}
              animate={phase >= 2 ? { opacity: 0.6 } : {}}
            >
              v2.0.0 — Flutter Ready
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
