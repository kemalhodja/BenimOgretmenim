/**
 * Deploy öncesi otomatik kontroller (CI ile aynı çekirdek).
 * Manuel Render adımları konsolda listelenir.
 *
 *   npm run pre-deploy:check
 */
import { spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const deployEnv = { ...process.env };
if (!deployEnv.NEXT_PUBLIC_API_BASE_URL?.trim()) {
  deployEnv.NEXT_PUBLIC_API_BASE_URL = "https://api.benimogretmenim.com.tr";
}
if (!deployEnv.INTERNAL_API_BASE_URL?.trim()) {
  deployEnv.INTERNAL_API_BASE_URL = deployEnv.NEXT_PUBLIC_API_BASE_URL;
}
if (!deployEnv.NEXT_PUBLIC_SITE_URL?.trim()) {
  deployEnv.NEXT_PUBLIC_SITE_URL = "https://benimogretmenim.com.tr";
}

function run(label, cmd, args, cwd = repoRoot) {
  console.log(`\n[pre-deploy] ${label}`);
  const r = spawnSync(cmd, args, {
    cwd,
    env: deployEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`[pre-deploy] FAIL: ${label}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[pre-deploy] BenimÖğretmenim deploy öncesi platform kontrolü\n");

run("API test + build", "npm", ["run", "ci:api"]);
run("Web lint + role-features + build", "npm", ["run", "ci:web"]);

console.log(`
[pre-deploy] Otomatik kontroller geçti.

Deploy öncesi Render Dashboard (elle):
  • PAYTR merchant + PAYTR_OPTIONAL kaldır (canlı ödeme açılacaksa)
  • SMOKE_RUN_SECRET = GitHub Actions secret ile aynı
  • RESEND_API_KEY + EMAIL_FROM (veli e-posta)
  • Blueprint Sync → yeni cron job'lar aktif mi?
  • Prod'da en az bir doğrulanmış öğretmen varsa Zigo vitrin dolu olur (preDeploy seed)

Deploy sonrası:
  npm run smoke:prod
  (SMOKE_API_URL=https://api.benimogretmenim.com.tr)
`);
