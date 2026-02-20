const MOBILE_TOKEN_KEY = "socialflow_mobile_access_token";
const PENDING_VERIFY_EMAIL_KEY = "socialflow_pending_verify_email";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

export function getMobileAccessToken(): string {
  if (typeof window === "undefined") return "";
  return (window.localStorage.getItem(MOBILE_TOKEN_KEY) || "").trim();
}

export function setMobileAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  const normalized = String(token || "").trim();
  if (!normalized) {
    window.localStorage.removeItem(MOBILE_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(MOBILE_TOKEN_KEY, normalized);
}

export function clearMobileAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(MOBILE_TOKEN_KEY);
}

export function setPendingVerificationEmail(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) {
    window.localStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_VERIFY_EMAIL_KEY, normalized);
}

export function getPendingVerificationEmail(): string {
  if (typeof window === "undefined") return "";
  return (window.localStorage.getItem(PENDING_VERIFY_EMAIL_KEY) || "").trim().toLowerCase();
}

export function clearPendingVerificationEmail(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false) {
    const token = getMobileAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const message = String(payload?.error || `Request failed: ${response.status}`);
    throw new Error(message);
  }
  return payload as T;
}

