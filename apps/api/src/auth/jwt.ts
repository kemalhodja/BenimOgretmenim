import * as jose from "jose";

function getSecretKey(): Uint8Array {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET_required_in_production");
  }
  return new TextEncoder().encode(raw ?? "dev-only-change-me-use-32-chars-min");
}

export async function signAccessToken(input: {
  userId: string;
  role: string;
  adminScope?: string | null;
  expiresIn?: string;
}): Promise<string> {
  const claims: Record<string, string> = { role: input.role };
  if (input.role === "admin" && input.adminScope) {
    claims.adminScope = input.adminScope;
  }
  const expires =
    input.expiresIn?.trim() ||
    process.env.JWT_EXPIRES?.trim() ||
    "90d";
  return new jose.SignJWT(claims)
    .setSubject(input.userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<{
  userId: string;
  role: string;
  adminScope?: string;
}> {
  const { payload } = await jose.jwtVerify(token, getSecretKey());
  const sub = payload.sub;
  if (!sub) {
    throw new Error("invalid_token");
  }
  const role = typeof payload.role === "string" ? payload.role : "";
  const adminScope = typeof payload.adminScope === "string" ? payload.adminScope : undefined;
  return { userId: sub, role, adminScope };
}
