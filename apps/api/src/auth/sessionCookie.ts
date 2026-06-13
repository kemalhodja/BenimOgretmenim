import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppVariables } from "../types.js";

export const SESSION_COOKIE_NAME = "bo_session";

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
}

export function clearSessionCookie(c: Context<{ Variables: AppVariables }>): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    secure: cookieSecure(),
    sameSite: "Lax",
  });
}
