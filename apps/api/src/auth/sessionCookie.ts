import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import type { AppVariables } from "../types.js";

export const SESSION_COOKIE_NAME = "bo_session";
export const SESSION_ROLE_COOKIE_NAME = "bo_session_role";
export const SESSION_USER_ID_COOKIE_NAME = "bo_session_user_id";
export const SESSION_ADMIN_SCOPE_COOKIE_NAME = "bo_session_admin_scope";
export const CSRF_COOKIE_NAME = "bo_csrf";
export const SESSION_PERSISTENT_COOKIE_NAME = "bo_session_persistent";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_HEADER_VALUE = "bo-csrf-v1";

const DEFAULT_REMEMBER_MAX_AGE = 60 * 60 * 24 * 90;
const DEFAULT_BRIEF_MAX_AGE = 60 * 60 * 24;

function parseMaxAgeEnv(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60) return fallback;
  return Math.floor(n);
}

/** "Beni hatırla" — çıkış yapana kadar uzun oturum (varsayılan 90 gün). */
export function rememberSessionMaxAgeSeconds(): number {
  return parseMaxAgeEnv(
    process.env.SESSION_REMEMBER_MAX_AGE_SECONDS?.trim() ??
      process.env.SESSION_COOKIE_MAX_AGE_SECONDS?.trim(),
    DEFAULT_REMEMBER_MAX_AGE,
  );
}

/** Kısa oturum — paylaşımlı cihazlar için (varsayılan 1 gün). */
export function briefSessionMaxAgeSeconds(): number {
  return parseMaxAgeEnv(process.env.SESSION_BRIEF_MAX_AGE_SECONDS?.trim(), DEFAULT_BRIEF_MAX_AGE);
}

function sessionCookieMaxAgeSeconds(): number {
  return rememberSessionMaxAgeSeconds();
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function readSessionCookie(c: Context<{ Variables: AppVariables }>): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME)?.trim() || undefined;
}

export function setSessionCookie(
  c: Context<{ Variables: AppVariables }>,
  token: string,
  maxAgeSeconds: number = sessionCookieMaxAgeSeconds(),
): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
  setCookie(c, CSRF_COOKIE_NAME, newCsrfToken(), {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function setSessionHintCookies(
  c: Context<{ Variables: AppVariables }>,
  opts: { role: string; userId: string; adminScope?: string | null },
  maxAgeSeconds: number = sessionCookieMaxAgeSeconds(),
): void {
  const common = {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
  setCookie(c, SESSION_ROLE_COOKIE_NAME, opts.role, common);
  setCookie(c, SESSION_USER_ID_COOKIE_NAME, opts.userId, common);
  if (opts.role === "admin") {
    setCookie(c, SESSION_ADMIN_SCOPE_COOKIE_NAME, opts.adminScope ?? "full", common);
  }
}

export function setSessionPersistentFlag(
  c: Context<{ Variables: AppVariables }>,
  rememberMe: boolean,
  maxAgeSeconds: number,
): void {
  setCookie(c, SESSION_PERSISTENT_COOKIE_NAME, rememberMe ? "1" : "0", {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function readSessionPersistentFlag(c: Context<{ Variables: AppVariables }>): boolean {
  const raw = getCookie(c, SESSION_PERSISTENT_COOKIE_NAME)?.trim();
  if (raw === "0") return false;
  if (raw === "1") return true;
  return true;
}

export function clearSessionCookie(c: Context<{ Variables: AppVariables }>): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
  deleteCookie(c, SESSION_ROLE_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
  deleteCookie(c, SESSION_USER_ID_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
  deleteCookie(c, SESSION_ADMIN_SCOPE_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
  deleteCookie(c, CSRF_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
  deleteCookie(c, SESSION_PERSISTENT_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
}

export function isUnsafeHttpMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export function hasValidCsrfHeader(c: Context<{ Variables: AppVariables }>): boolean {
  const header = c.req.header(CSRF_HEADER_NAME)?.trim();
  if (!header) return false;
  const csrfCookie = getCookie(c, CSRF_COOKIE_NAME)?.trim();
  if (csrfCookie) return header === csrfCookie;
  return header === CSRF_HEADER_VALUE;
}
