import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type Theme = "light" | "dark";
type Language = "ar" | "en";

interface ThemeContextType {
  theme: Theme;
  language: Language;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  dir: "rtl" | "ltr";
  fontFamily: string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      const storedTheme = (localStorage.getItem("sh-theme") as Theme) || "";
      if (storedTheme === "dark" || storedTheme === "light") {
        return storedTheme;
      }
      return root.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      const storedLang = (localStorage.getItem("sh-lang") as Language) || "";
      if (storedLang === "ar" || storedLang === "en") {
        return storedLang;
      }
      return root.lang === "en" ? "en" : "ar";
    }
    return "ar";
  });

  useEffect(() => {
    localStorage.setItem("sh-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("sh-lang", language);
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === "ar" ? "en" : "ar"));
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const setLanguage = useCallback((l: Language) => setLanguageState(l), []);

  const t = useCallback(
    (ar: string, en: string) => (language === "ar" ? ar : en),
    [language]
  );

  const dir = language === "ar" ? "rtl" : "ltr";
  const fontFamily = language === "ar" ? "Cairo, sans-serif" : "Inter, sans-serif";

  return (
    <ThemeContext.Provider
      value={{ theme, language, toggleTheme, toggleLanguage, setTheme, setLanguage, t, dir, fontFamily }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
