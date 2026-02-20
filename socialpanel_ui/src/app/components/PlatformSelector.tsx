import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  getPlatformIcon,
  platforms,
  type PlatformInfo,
  type PlatformType,
} from "./PlatformIcons";

interface PlatformSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (platform: PlatformInfo) => void;
  connectedPlatforms: PlatformType[];
}

export function PlatformSelector({
  isOpen,
  onClose,
  onSelect,
  connectedPlatforms,
}: PlatformSelectorProps) {
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = platforms.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.includes(search)
  );

  const connectedCount = connectedPlatforms.length;
  const totalCount = platforms.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-3 sm:p-4"
          style={{ zIndex: 90 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            className="relative w-full max-w-lg rounded-3xl overflow-hidden bg-white max-h-[90vh] flex flex-col"
            style={{
              boxShadow: "0 25px 60px rgba(0,0,0,0.15), 0 0 40px rgba(139,92,246,0.06)",
            }}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            {/* Header gradient */}
            <motion.div
              className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shrink-0"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ transformOrigin: "left" }}
            />

            <div className="p-5 sm:p-6 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-5 shrink-0">
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  <X className="w-4 h-4 text-slate-500" />
                </button>
                <div className="text-right" dir="rtl">
                  <div className="flex items-center gap-2 justify-end">
                    <h2 className="text-slate-800" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
                      إضافة حساب جديد
                    </h2>
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  </div>
                  <p className="text-slate-500 mt-1" style={{ fontSize: "0.8125rem" }}>
                    {connectedCount} من {totalCount} منصة مربوطة
                  </p>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-4 shrink-0">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث عن منصة..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full py-3 pr-10 pl-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all text-right"
                  dir="rtl"
                  style={{ fontSize: "0.875rem" }}
                />
              </div>

              {/* Platforms Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 custom-scrollbar flex-1">
                {filtered.map((platform, i) => {
                  const isConnected = connectedPlatforms.includes(platform.id);
                  return (
                    <motion.button
                      key={platform.id}
                      className="relative group text-right rounded-2xl overflow-hidden transition-all"
                      style={{
                        background:
                          hoveredId === platform.id ? "#f8f9fb" : "white",
                        border: `1px solid ${
                          hoveredId === platform.id
                            ? "rgba(0,0,0,0.1)"
                            : "rgba(0,0,0,0.05)"
                        }`,
                        boxShadow:
                          hoveredId === platform.id
                            ? `0 6px 20px ${platform.bgGlow}`
                            : "0 1px 4px rgba(0,0,0,0.02)",
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onHoverStart={() => setHoveredId(platform.id)}
                      onHoverEnd={() => setHoveredId(null)}
                      onClick={() => onSelect(platform)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      dir="rtl"
                    >
                      <div className="p-3.5">
                        <div className="flex items-center gap-3">
                          <motion.div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${platform.bgGlow}, rgba(248,250,252,0.8))`,
                              border: `1px solid ${platform.bgGlow}`,
                            }}
                            animate={
                              hoveredId === platform.id
                                ? { boxShadow: `0 4px 15px ${platform.bgGlow}` }
                                : { boxShadow: "none" }
                            }
                          >
                            {getPlatformIcon(platform.id, 22)}
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-slate-700 truncate" style={{ fontSize: "0.875rem" }}>
                                {platform.name}
                              </p>
                              {isConnected && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-slate-400 truncate" style={{ fontSize: "0.75rem" }}>
                              {platform.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Hover Arrow */}
                      <motion.div
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        initial={{ opacity: 0, x: 5 }}
                        animate={{
                          opacity: hoveredId === platform.id ? 1 : 0,
                          x: hoveredId === platform.id ? 0 : 5,
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 text-slate-400" />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-slate-500" style={{ fontSize: "0.875rem" }}>
                    لم يتم العثور على منصات
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
