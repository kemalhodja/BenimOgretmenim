const TOKEN_KEY = "bo:token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

type UserRole = "student" | "teacher" | "guardian" | "admin";

function base64UrlToJson(input: string): unknown | null {
  try {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const text = atob(`${b64}${pad}`);
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function getRoleFromToken(token: string | null): UserRole | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = base64UrlToJson(parts[1]);
  const role =
    typeof payload === "object" && payload && "role" in payload
      ? (payload as { role?: unknown }).role
      : null;
  if (role === "teacher" || role === "student" || role === "guardian" || role === "admin") return role;
  return null;
}

export function panelPathForRole(role: UserRole): string {
  // Not: admin paneli ayrı sayfada.
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "guardian") return "/guardian";
  return "/student/requests";
}

