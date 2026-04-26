export function formatDbConnectError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e?.code === "ECONNREFUSED") {
    return [
      "PostgreSQL'e bağlanılamadı (ECONNREFUSED).",
      "",
      "Seçenekler:",
      "- apps/api içinde: npm run db:up  (Docker Compose ile Postgres başlatır)",
      "- veya proje kökünde: docker compose up -d",
      "- Windows: PostgreSQL yükleyip 5432'de servis başlatın",
      "- Bulut: Neon / Supabase ile DATABASE_URL tanımlayın (apps/api/.env)",
      "",
      `Teknik: ${e.message ?? ""}`,
    ].join("\n");
  }
  return e?.message ?? String(err);
}
