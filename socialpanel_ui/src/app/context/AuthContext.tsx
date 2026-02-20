import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  apiRequest,
  clearMobileAccessToken,
  clearPendingVerificationEmail,
  getPendingVerificationEmail,
  setMobileAccessToken,
  setPendingVerificationEmail,
} from "../services/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider?: "email" | "google" | "twitter" | "facebook";
  joinedAt: string;
  plan: "free" | "pro" | "enterprise";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<boolean>;
  socialLogin: (provider: "google" | "twitter" | "facebook") => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string) => Promise<boolean>;
  verifyEmail: (code: string, email?: string) => Promise<boolean>;
  completePasswordReset: (email: string, code: string, password: string) => Promise<boolean>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const normalizeUser = useCallback((raw: any): User => {
    const id = String(raw?.id || "");
    const name = String(raw?.name || "User");
    const email = String(raw?.email || "").toLowerCase();
    return {
      id,
      name,
      email,
      avatar: typeof raw?.image === "string" ? raw.image : undefined,
      provider: "email",
      joinedAt: raw?.createdAt ? new Date(raw.createdAt).toLocaleDateString("ar") : "",
      plan: (raw?.plan as "free" | "pro" | "enterprise") || "free",
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const tokenPayload = await apiRequest<{ success: boolean; user: any }>("/api/mobile/me");
        if (!active) return;
        setUser(normalizeUser(tokenPayload.user));
      } catch {
        if (!active) return;
        clearMobileAccessToken();
        setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [normalizeUser]);

  const clearAuthError = useCallback(() => {
    setAuthError("");
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setAuthError("");
    try {
      const payload = await apiRequest<{
        success: boolean;
        accessToken: string;
        user: any;
      }>("/api/mobile/login", {
        method: "POST",
        auth: false,
        body: {
          email: String(email || "").trim().toLowerCase(),
          password: String(password || ""),
        },
      });
      setMobileAccessToken(payload.accessToken || "");
      setUser(normalizeUser(payload.user));
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in");
      clearMobileAccessToken();
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const socialLogin = useCallback(async (provider: "google" | "twitter" | "facebook") => {
    setIsLoading(true);
    setAuthError("");
    try {
      const providerMap = await apiRequest<Record<string, { id: string; name?: string }>>(
        "/api/auth/providers",
        { auth: false }
      );
      const providerConfig = providerMap?.[provider];
      if (!providerConfig?.id) {
        setAuthError(`${provider} sign in is not configured on the server yet.`);
        return false;
      }

      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/index.html#/dashboard`
          : "/index.html#/dashboard";
      const signInUrl = `/api/auth/signin/${encodeURIComponent(
        providerConfig.id
      )}?callbackUrl=${encodeURIComponent(callbackUrl)}`;

      if (typeof window !== "undefined") {
        window.location.assign(signInUrl);
      }
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to start social sign in");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setAuthError("");
    try {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const payload = await apiRequest<{
        success: boolean;
        verificationRequired?: boolean;
      }>("/api/auth/register", {
        method: "POST",
        auth: false,
        body: {
          name: String(name || "").trim(),
          email: normalizedEmail,
          password: String(password || ""),
        },
      });
      if (payload.verificationRequired) {
        setPendingVerificationEmail(normalizedEmail);
      }
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to create account");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearMobileAccessToken();
    setUser(null);
    setAuthError("");
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true);
    setAuthError("");
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email: String(email || "").trim().toLowerCase() },
      });
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to send reset code");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (code: string, email?: string) => {
    setIsLoading(true);
    setAuthError("");
    try {
      const resolvedEmail = String(email || getPendingVerificationEmail() || "")
        .trim()
        .toLowerCase();
      if (!resolvedEmail) {
        throw new Error("Missing email for verification");
      }
      await apiRequest("/api/auth/verify-email", {
        method: "POST",
        auth: false,
        body: {
          email: resolvedEmail,
          code: String(code || "").trim(),
        },
      });
      clearPendingVerificationEmail();
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to verify email");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const completePasswordReset = useCallback(
    async (email: string, code: string, password: string) => {
      setIsLoading(true);
      setAuthError("");
      try {
        await apiRequest("/api/auth/reset-password", {
          method: "POST",
          auth: false,
          body: {
            email: String(email || "").trim().toLowerCase(),
            code: String(code || "").trim(),
            password: String(password || ""),
          },
        });
        return true;
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to reset password");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        login,
        socialLogin,
        signup,
        logout,
        resetPassword,
        verifyEmail,
        completePasswordReset,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
