import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes } from "node:crypto";
import type { AppVariables } from "../types.js";

export const SESSION_COOKIE_NAME = "bo_session";
export const SESSION_ROLE_COOKIE_NAME = "bo_session_role";
export const SESSION_USER_ID_COOKIE_NAME = "bo_session_user_id";
export const CSRF_COOKIE_NAME = "bo_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_HEADER_VALUE = "bo-csrf-v1";

function sessionCookieMaxAgeSeconds(): number {
  const raw = process.env.SESSION_COOKIE_MAX_AGE_SECONDS?.trim();
  if (!raw) return 60 * 60 * 24 * 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60) return 60 * 60 * 24 * 7;
  return Math.floor(n);
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

export function setSessionCookie(c: Context<{ Variables: AppVariables }>, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds(),
  });
  setCookie(c, CSRF_COOKIE_NAME, newCsrfToken(), {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds(),
  });
}

export function setSessionHintCookies(
  c: Context<{ Variables: AppVariables }>,
  opts: { role: string; userId: string },
): void {
  const common = {
    httpOnly: false,
    secure: cookieSecure(),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: sessionCookieMaxAgeSeconds(),
  };
  setCookie(c, SESSION_ROLE_COOKIE_NAME, opts.role, common);
  setCookie(c, SESSION_USER_ID_COOKIE_NAME, opts.userId, common);
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
  deleteCookie(c, CSRF_COOKIE_NAME, {
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
