import * as jose from "jose";

function getSecretKey(): Uint8Array {
  const raw = process.env.JWT_SECRET ?? "dev-only-change-me-use-32-chars-min";
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(input: {
  userId: string;
  role: string;
}): Promise<string> {
  return new jose.SignJWT({ role: input.role })
    .setSubject(input.userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES ?? "7d")
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<{
  userId: string;
  role: string;
}> {
  const { payload } = await jose.jwtVerify(token, getSecretKey());
  const sub = payload.sub;
  if (!sub) {
    throw new Error("invalid_token");
  }
  const role = typeof payload.role === "string" ? payload.role : "";
  return { userId: sub, role };
}
