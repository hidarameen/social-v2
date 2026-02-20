import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface SocialLoginButtonsProps {
  onSocialLogin: (provider: "google" | "twitter" | "facebook") => Promise<boolean>;
  isLoading?: boolean;
}

export function SocialLoginButtons({ onSocialLogin, isLoading }: SocialLoginButtonsProps) {
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const handleClick = async (provider: "google" | "twitter" | "facebook") => {
    setActiveProvider(provider);
    await onSocialLogin(provider);
    setActiveProvider(null);
  };

  const providers = [
    {
      id: "google" as const,
      name: "Google",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      bg: "bg-white",
      border: "border-slate-200",
      text: "text-slate-700",
      hoverBg: "hover:bg-slate-50",
    },
    {
      id: "twitter" as const,
      name: "X",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#14171A"/>
        </svg>
      ),
      bg: "bg-white",
      border: "border-slate-200",
      text: "text-slate-700",
      hoverBg: "hover:bg-slate-50",
    },
    {
      id: "facebook" as const,
      name: "Facebook",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/>
        </svg>
      ),
      bg: "bg-white",
      border: "border-slate-200",
      text: "text-slate-700",
      hoverBg: "hover:bg-slate-50",
    },
  ];

  return (
    <div className="space-y-3">
      {providers.map((provider, i) => (
        <motion.button
          key={provider.id}
          onClick={() => handleClick(provider.id)}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl ${provider.bg} ${provider.text} ${provider.hoverBg} transition-all disabled:opacity-50`}
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            fontSize: "0.875rem",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          whileHover={{ scale: 1.01, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          whileTap={{ scale: 0.99 }}
        >
          {activeProvider === provider.id ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            provider.icon
          )}
          <span>المتابعة عبر {provider.name}</span>
        </motion.button>
      ))}
    </div>
  );
}
