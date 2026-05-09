/**
 * Yerel tam entegrasyon E2E: PostgreSQL + migrate + seed + API (3002) + web build + Playwright @integration
 * Önkoşul: Docker Desktop çalışıyor veya 127.0.0.1:5432 PostgreSQL ayakta.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appsWeb = path.join(repoRoot, "apps", "web");
const appsApi = path.join(repoRoot, "apps", "api");

const HEALTH = "http://127.0.0.1:3002/health";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function runNpm(runScript, cwd = repoRoot) {
  const r = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", runScript],
    { cwd, stdio: "inherit", shell: process.platform === "win32", env: process.env },
  );
  if ((r.status ?? 1) !== 0) {
    process.exit(r.status ?? 1);
  }
}

async function waitDbReady(maxMs = 120000) {
  const start = Date.now();
  console.log("[e2e:integration] PostgreSQL bekleniyor...");
  while (Date.now() - start < maxMs) {
    const r = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "db:check"],
      { cwd: repoRoot, stdio: "pipe", shell: process.platform === "win32", encoding: "utf-8" },
    );
    if ((r.status ?? 1) === 0) {
      console.log("[e2e:integration] Veritabanı hazır.");
      return;
    }
    await sleep(1500);
  }
  throw new Error(
    "PostgreSQL hazır olmadı. Docker Desktop'ı açıp `npm run db:up` deneyin.",
  );
}

async function waitApiHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(HEALTH, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log("[e2e:integration] API hazır:", HEALTH);
        return;
      }
    } catch {
      /* tekrar dene */
    }
    await sleep(500);
  }
  throw new Error(`API health yanıt vermedi: ${HEALTH}`);
}

async function main() {
  process.chdir(repoRoot);

  console.log("[e2e:integration] PostgreSQL (docker compose via apps/api db:up) …");
  const up = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "db:up"],
    { cwd: appsApi, stdio: "inherit", shell: process.platform === "win32" },
  );
  if ((up.status ?? 1) !== 0) {
    console.warn(
      "[e2e:integration] db:up başarısız; yerel PostgreSQL var mı diye db:check deneniyor…",
    );
    const check = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "db:check"],
      { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
    );
    if ((check.status ?? 1) !== 0) {
      console.error(
        "[e2e:integration] Ne docker db:up ne de db:check başarılı. Docker Desktop PATH'te olmalı veya `apps/api` içinde `npm run db:up` çalışmalı.",
      );
      process.exit(up.status ?? 1);
    }
    console.log("[e2e:integration] Veritabanı zaten erişilebilir, devam.");
  }

  try {
    await waitDbReady();
  } catch (e) {
    console.error("[e2e:integration]", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  runNpm("db:migrate");
  runNpm("db:seed");
  runNpm("db:seed:admin");

  runNpm("build", appsApi);

  const apiChild = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "start"],
    {
      cwd: appsApi,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, PORT: "3002" },
    },
  );

  const killApi = () => {
    if (apiChild.pid && !apiChild.killed) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(apiChild.pid), "/T", "/F"], {
          stdio: "ignore",
          shell: true,
        });
      } else {
        apiChild.kill("SIGTERM");
      }
    }
  };

  process.on("SIGINT", () => {
    killApi();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    killApi();
    process.exit(143);
  });

  let exitCode = 1;
  try {
    await waitApiHealth();

    const webEnv = {
      ...process.env,
      WEB_ALLOW_HTTP: "1",
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:3002",
      INTERNAL_API_BASE_URL: "http://127.0.0.1:3002",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    };

    if (process.env.INTEGRATION_E2E_SKIP_WEB_BUILD !== "1") {
      console.log("[e2e:integration] Web production build …");
      const b = spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "build"],
        { cwd: appsWeb, stdio: "inherit", shell: process.platform === "win32", env: webEnv },
      );
      if ((b.status ?? 1) !== 0) exitCode = b.status ?? 1;
      else {
        const pw = spawnSync(
          process.platform === "win32" ? "npm.cmd" : "npm",
          ["run", "test:e2e:integration"],
          { cwd: appsWeb, stdio: "inherit", shell: process.platform === "win32", env: webEnv },
        );
        exitCode = pw.status ?? 1;
      }
    } else if (!existsSync(path.join(appsWeb, ".next"))) {
      console.error(
        "[e2e:integration] INTEGRATION_E2E_SKIP_WEB_BUILD=1 ama apps/web/.next yok.",
      );
      exitCode = 1;
    } else {
      const pw = spawnSync(
        process.platform === "win32" ? "npm.cmd" : "npm",
        ["run", "test:e2e:integration"],
        { cwd: appsWeb, stdio: "inherit", shell: process.platform === "win32", env: webEnv },
      );
      exitCode = pw.status ?? 1;
    }
  } catch (e) {
    console.error("[e2e:integration]", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    killApi();
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
