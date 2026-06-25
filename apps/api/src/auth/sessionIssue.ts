import type { Context } from "hono";
import { signAccessToken } from "./jwt.js";
import {
  briefSessionMaxAgeSeconds,
  readSessionPersistentFlag,
  rememberSessionMaxAgeSeconds,
  setSessionCookie,
  setSessionHintCookies,
  setSessionPersistentFlag,
} from "./sessionCookie.js";
import type { AppVariables } from "../types.js";

type AuthContext = Context<{ Variables: AppVariables }>;

export function sessionAuthDuration(rememberMe: boolean): {
  maxAgeSeconds: number;
  jwtExpires: string;
} {
  if (rememberMe) {
    return {
      maxAgeSeconds: rememberSessionMaxAgeSeconds(),
      jwtExpires: process.env.JWT_REMEMBER_EXPIRES?.trim() || "90d",
    };
  }
  return {
    maxAgeSeconds: briefSessionMaxAgeSeconds(),
    jwtExpires: process.env.JWT_BRIEF_EXPIRES?.trim() || "1d",
  };
}

export async function issueUserAuthSession(
  c: AuthContext,
  user: { userId: string; role: string; adminScope?: string | null },
  rememberMe: boolean,
): Promise<string> {
  const { maxAgeSeconds, jwtExpires } = sessionAuthDuration(rememberMe);
  const token = await signAccessToken({
    userId: user.userId,
    role: user.role,
    adminScope: user.role === "admin" ? (user.adminScope ?? "full") : null,
    expiresIn: jwtExpires,
  });
  setSessionCookie(c, token, maxAgeSeconds);
  setSessionHintCookies(
    c,
    {
      role: user.role,
      userId: user.userId,
      adminScope: user.adminScope ?? null,
    },
    maxAgeSeconds,
  );
  setSessionPersistentFlag(c, rememberMe, maxAgeSeconds);
  return token;
}

export function readRememberMeFromSession(c: AuthContext): boolean {
  return readSessionPersistentFlag(c);
}
