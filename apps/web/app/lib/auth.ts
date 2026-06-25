import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "./api";

const TOKEN_KEY = "bo:token";
const ROLE_KEY = "bo:role";
const USER_ID_KEY = "bo:user-id";
const REMEMBER_ME_PREF_KEY = "bo:remember-me";
const ROLE_COOKIE_NAME = "bo_session_role";
const USER_ID_COOKIE_NAME = "bo_session_user_id";
const ADMIN_SCOPE_COOKIE_NAME = "bo_session_admin_scope";
const CSRF_COOKIE_NAME = "bo_csrf";
const COOKIE_SESSION_TOKEN_PREFIX = "bo-cookie-session:";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function clearServerSessionCookie() {
  void fetch("/v1/auth/logout", {
    method: "POST",
    headers: { [CSRF_HEADER_NAME]: readCookie(CSRF_COOKIE_NAME) ?? CSRF_HEADER_VALUE },
    credentials: "include",
    cache: "no-store",
  }).catch(() => {});
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const cookieRole = readCookie(ROLE_COOKIE_NAME);
  if (cookieRole === "teacher" || cookieRole === "student" || cookieRole === "guardian" || cookieRole === "admin") {
    const userId = readCookie(USER_ID_COOKIE_NAME) ?? "";
    return `${COOKIE_SESSION_TOKEN_PREFIX}${cookieRole}:${encodeURIComponent(userId)}`;
  }
  const role = window.localStorage.getItem(ROLE_KEY) ?? readCookie(ROLE_COOKIE_NAME);
  if (role === "teacher" || role === "student" || role === "guardian" || role === "admin") {
    const userId = window.localStorage.getItem(USER_ID_KEY) ?? readCookie(USER_ID_COOKIE_NAME) ?? "";
    return `${COOKIE_SESSION_TOKEN_PREFIX}${role}:${encodeURIComponent(userId)}`;
  }
  return null;
}

function removeLocalSessionCache() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("bo:auth-changed"));
}

function cacheRole(role: UserRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.localStorage.setItem(ROLE_KEY, role);
  else window.localStorage.removeItem(ROLE_KEY);
}

function cacheUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  if (userId) window.localStorage.setItem(USER_ID_KEY, userId);
  else window.localStorage.removeItem(USER_ID_KEY);
}

function parseCookieSessionToken(token: string): { role: UserRole; userId: string | null } | null {
  if (!token.startsWith(COOKIE_SESSION_TOKEN_PREFIX)) return null;
  const rest = token.slice(COOKIE_SESSION_TOKEN_PREFIX.length);
  const [role, encodedUserId = ""] = rest.split(":");
  if (role !== "teacher" && role !== "student" && role !== "guardian" && role !== "admin") return null;
  return {
    role,
    userId: encodedUserId ? decodeURIComponent(encodedUserId) : null,
  };
}

export function isCookieSessionToken(token: string | null | undefined): boolean {
  return Boolean(token?.startsWith(COOKIE_SESSION_TOKEN_PREFIX));
}

export function setToken(token: string | null) {
  if (!token) {
    removeLocalSessionCache();
    notifyAuthChanged();
    return;
  }
  if (isCookieSessionToken(token)) {
    const parsed = parseCookieSessionToken(token);
    cacheRole(parsed?.role ?? null);
    cacheUserId(parsed?.userId ?? null);
  } else {
    cacheRole(getRoleFromToken(token));
    cacheUserId(getUserIdFromToken(token));
  }
  window.localStorage.removeItem(TOKEN_KEY);
  notifyAuthChanged();
}

/** Giriş/kayıt sonrası: JWT client'ta tutulmaz, HttpOnly cookie + /me ile oturum senkronu. */
export async function commitAuthSession(): Promise<UserRole | null> {
  window.localStorage.removeItem(TOKEN_KEY);
  return refreshSessionFromServer();
}

export function getRememberMePreference(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(REMEMBER_ME_PREF_KEY);
  if (raw === "0") return false;
  return true;
}

export function setRememberMePreference(remember: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_ME_PREF_KEY, remember ? "1" : "0");
}

export function clearToken() {
  removeLocalSessionCache();
  clearServerSessionCookie();
  notifyAuthChanged();
}

export type UserRole = "student" | "teacher" | "guardian" | "admin";
export type AdminScope = "full" | "finance" | "support";

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
  const cookieSession = parseCookieSessionToken(token);
  if (cookieSession) return cookieSession.role;
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

export function adminScopeLabel(scope: string | null | undefined): string {
  if (scope === "finance") return "Finans";
  if (scope === "support") return "Destek";
  return "Tam yetki";
}

export function setAdminScopeHintCookie(scope: AdminScope) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ADMIN_SCOPE_COOKIE_NAME}=${encodeURIComponent(scope)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}

export function getAdminScopeFromSession(): AdminScope {
  if (typeof window === "undefined") return "full";
  const raw = readCookie(ADMIN_SCOPE_COOKIE_NAME);
  if (raw === "finance" || raw === "support") return raw;
  return "full";
}

export function getCachedRole(): UserRole | null {
  const fromToken = getRoleFromToken(getToken());
  if (fromToken) return fromToken;
  if (typeof window === "undefined") return null;
  const role = window.localStorage.getItem(ROLE_KEY) ?? readCookie(ROLE_COOKIE_NAME);
  if (role === "teacher" || role === "student" || role === "guardian" || role === "admin") return role;
  return null;
}

/** JWT `sub` — oturumdaki kullanıcı kimliği (admin işlemlerinde kendi satırını ayırt etmek için). */
export function getUserIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const cookieSession = parseCookieSessionToken(token);
  if (cookieSession) return cookieSession.userId;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = base64UrlToJson(parts[1]);
  const sub =
    typeof payload === "object" && payload && "sub" in payload
      ? (payload as { sub?: unknown }).sub
      : null;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

export function getCachedUserId(): string | null {
  const fromToken = getUserIdFromToken(getToken());
  if (fromToken) return fromToken;
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_ID_KEY) ?? readCookie(USER_ID_COOKIE_NAME);
}

type SessionMeResponse = {
  user?: {
    id?: unknown;
    role?: unknown;
    adminScope?: unknown;
  };
};

export async function refreshSessionFromServer(): Promise<UserRole | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/v1/auth/me", {
      headers: { accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 404) {
      removeLocalSessionCache();
      notifyAuthChanged();
      return null;
    }
    if (res.status === 403) {
      return getCachedRole();
    }
    if (!res.ok) return getCachedRole();
    const json = (await res.json()) as SessionMeResponse;
    const role = json.user?.role;
    const userId = json.user?.id;
    const adminScope = json.user?.adminScope;
    const safeRole =
      role === "teacher" || role === "student" || role === "guardian" || role === "admin"
        ? role
        : null;
    cacheRole(safeRole);
    cacheUserId(typeof userId === "string" ? userId : null);
    if (safeRole === "admin" && (adminScope === "finance" || adminScope === "support" || adminScope === "full")) {
      setAdminScopeHintCookie(adminScope);
    }
    window.localStorage.removeItem(TOKEN_KEY);
    notifyAuthChanged();
    return safeRole;
  } catch {
    return getCachedRole();
  }
}

const SESSION_RENEW_INTERVAL_MS = 20 * 60 * 1000;
let lastSessionRenewAt = 0;
let renewInFlight: Promise<boolean> | null = null;

/** Kaydırılabilir oturum: aktif kullanıcıda JWT + çerez süresini uzatır. */
export async function renewAuthSession(force = false): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!getCachedRole() && !getToken()) return false;

  const now = Date.now();
  if (!force && now - lastSessionRenewAt < SESSION_RENEW_INTERVAL_MS) {
    return true;
  }
  if (renewInFlight) return renewInFlight;

  renewInFlight = (async () => {
    try {
      const res = await fetch("/v1/auth/session/refresh", {
        method: "POST",
        headers: {
          accept: "application/json",
          [CSRF_HEADER_NAME]: readCookie(CSRF_COOKIE_NAME) ?? CSRF_HEADER_VALUE,
        },
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 404) {
        removeLocalSessionCache();
        notifyAuthChanged();
        return false;
      }
      if (res.status === 403) {
        return Boolean(getCachedRole());
      }
      if (!res.ok) return false;
      lastSessionRenewAt = Date.now();
      await refreshSessionFromServer();
      return true;
    } catch {
      return false;
    } finally {
      renewInFlight = null;
    }
  })();

  return renewInFlight;
}

export async function syncAuthSession(options?: { renew?: boolean }): Promise<UserRole | null> {
  const role = await refreshSessionFromServer();
  if (role && options?.renew !== false) {
    void renewAuthSession();
  }
  return role;
}

export function panelPathForRole(role: UserRole): string {
  // Not: admin paneli ayrı sayfada.
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "guardian") return "/guardian";
  return "/student/panel";
}

/** Giriş / kayıt sonrası varsayılan panel yolu */
export function defaultDestForRole(role: string): string {
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student/panel";
  if (role === "guardian") return "/guardian";
  if (role === "admin") return "/admin";
  return "/";
}

/** Kayıt sonrası onboarding parametreli hedefler */
export function registerDestForRole(role: string): string {
  if (role === "teacher") return "/teacher?onboarding=1";
  if (role === "student") return "/student/panel?onboarding=1";
  if (role === "guardian") return "/guardian?onboarding=1";
  if (role === "admin") return "/admin";
  return "/";
}

/** Oturumdaki rol, kendi panel alanında mı? (Üst çeredeki çift “panele git” önlenir.) */
export function isOnRolePanel(role: UserRole, pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
  if (role === "admin") return p === "/admin" || p.startsWith("/admin/");
  if (role === "teacher") return p === "/teacher" || p.startsWith("/teacher/");
  if (role === "guardian") return p === "/guardian" || p.startsWith("/guardian/");
  if (role === "student") return p === "/student" || p.startsWith("/student/");
  return false;
}

/** Üst menü / CTA kısa etiketleri */
export function panelNavLabel(role: UserRole): string {
  if (role === "admin") return "Yönetim";
  if (role === "teacher") return "Öğretmen paneli";
  if (role === "guardian") return "Veli paneli";
  return "Öğrenci paneli";
}

