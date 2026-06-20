export function formatDbConnectError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "ECONNREFUSED") {
    return [
      "PostgreSQL'e bağlanılamadı (ECONNREFUSED).",
      "",
      "Seçenekler:",
      "- apps/api içinde: npm run db:up  (Docker Compose ile Postgres başlatır)",
      "- veya proje kökünde: docker compose up -d",
      "- Docker: npm run db:up (127.0.0.1:5434) veya Windows PostgreSQL / Neon DATABASE_URL",
      "- Bulut: Neon / Supabase ile DATABASE_URL tanımlayın (apps/api/.env)",
      "",
      `Teknik: ${e.message ?? ""}`,
    ].join("\n");
  }
  return e?.message ?? String(err);
}
