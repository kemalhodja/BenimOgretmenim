import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const webRoot = path.join(repoRoot, "apps", "web");

const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

const env = { ...process.env };
if (!env.NEXT_PUBLIC_API_BASE_URL?.trim() || !env.NEXT_PUBLIC_SITE_URL?.trim()) {
  if (!isCi) {
    console.error(
      "[ci:web] NEXT_PUBLIC_API_BASE_URL ve NEXT_PUBLIC_SITE_URL ayarlı değil.\n" +
        "Örnek (PowerShell):\n" +
        '  $env:NEXT_PUBLIC_API_BASE_URL="https://benim-ogretmenim.onrender.com"\n' +
        '  $env:NEXT_PUBLIC_SITE_URL="https://benimogretmenim.onrender.com"\n' +
        '  $env:INTERNAL_API_BASE_URL="https://benim-ogretmenim.onrender.com"\n' +
        "  npm run ci:web\n",
    );
    process.exit(1);
  }

  // GitHub Actions / CI: keep defaults aligned with deploy-render workflow.
  env.NEXT_PUBLIC_API_BASE_URL =
    env.NEXT_PUBLIC_API_BASE_URL?.trim() || "https://benim-ogretmenim.onrender.com";
  env.INTERNAL_API_BASE_URL =
    env.INTERNAL_API_BASE_URL?.trim() || "https://benim-ogretmenim.onrender.com";
  env.NEXT_PUBLIC_SITE_URL =
    env.NEXT_PUBLIC_SITE_URL?.trim() || "https://benimogretmenim.onrender.com";
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: webRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status === 0) return;
  process.exit(r.status ?? 1);
}

run("npm", ["ci", "--include=dev"]);
run("npm", ["run", "lint"]);
run("npm", ["run", "build"]);
