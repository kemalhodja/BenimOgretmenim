/** Sunucu tarafında Hono API adresi (Docker’da http://api:3002 gibi). */
export function internalApiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://127.0.0.1:3002"
  );
}

export function adminProxyHeaders(req: Request): Headers {
  const h = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);
  h.set("accept", "application/json");
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (secret) h.set("x-admin-secret", secret);
  return h;
}
