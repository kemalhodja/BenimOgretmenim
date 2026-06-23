/**
 * Yönetici hesabı + operasyon kontrol listesi kurulumu.
 *
 *   ADMIN_BOOTSTRAP_PASSWORD='...' npm run ops:admin:setup
 *
 * İsteğe bağlı: ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_DISPLAY_NAME
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "../..");

function runNpm(script: string): void {
  console.log(`\n[ops:admin:setup] npm run ${script}…`);
  const r = spawnSync("npm", ["run", script], {
    cwd: apiRoot,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`[ops:admin:setup] npm run ${script} başarısız`);
    process.exit(r.status ?? 1);
  }
}

function main() {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!password) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD zorunludur (en az 10 karakter).");
    console.error("Örnek: ADMIN_BOOTSTRAP_PASSWORD='GucluParola2026!' npm run ops:admin:setup");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("ADMIN_BOOTSTRAP_PASSWORD en az 10 karakter olmalıdır.");
    process.exit(1);
  }

  const email = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@benimogretmenim.local").trim().toLowerCase();

  runNpm("db:migrate");
  runNpm("db:seed:admin");

  const repoRoot = path.resolve(apiRoot, "../..");

  console.log(`
═══════════════════════════════════════════════════════════
  Yönetici kurulumu tamam
═══════════════════════════════════════════════════════════

  Giriş e-postası : ${email}
  Panel           : /admin  (özet)
  Kontrol merkezi : /admin/merkez

  Yerel geliştirme:
    1. apps/api/.env → ADMIN_API_SECRET (web ile aynı)
    2. apps/web/.env.local → ADMIN_API_SECRET (API ile aynı)
    3. npm run dev + npm run web:dev

  Production (Render):
    • ADMIN_BOOTSTRAP_PASSWORD → API env (Render otomatik üretebilir)
    • ADMIN_API_SECRET → shared env group (web + api)
    • SMOKE_RUN_SECRET → GitHub + API (deploy smoke audit)
    • Parolayı Render Dashboard → benimogretmenim-api → Environment'dan alın

  Günlük takip (/admin/merkez):
    • Havale / abonelik ödemeleri
    • PayTR uyumsuzlukları
    • Para çekme talepleri
    • Öğretmen doğrulama
    • Destek SLA
    • Demo talepleri
    • Soru kalitesi + kampanya moderasyonu
    • Sistem sağlığı + admin audit

  Repo kökü: ${repoRoot}
`);
}

main();
