/**
 * Full local QA gate:
 * - API build + tests
 * - Web lint + build
 * - Public Playwright E2E
 * - Full local integration E2E
 * - API smoke suites against a local API
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const repoRoot = process.cwd();
const localApi = "http://127.0.0.1:3002";
const qaEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? "postgres://benim:benim_dev_change_me@127.0.0.1:5432/benimogretmenim",
  JWT_SECRET: process.env.JWT_SECRET ?? "ci-jwt-secret-must-be-at-least-32-characters-long",
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? "http://127.0.0.1:3000,http://localhost:3000",
  WEB_ALLOW_HTTP: "1",
  NEXT_PUBLIC_API_BASE_URL: localApi,
  INTERNAL_API_BASE_URL: localApi,
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
};

function run(label, args, env = qaEnv) {
  console.log(`\n[qa:full] ${label}`);
  const r = spawnSync(npm, args, { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32", env });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
}

async function healthy() {
  try {
    const res = await fetch(`${localApi}/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForApi(maxMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await healthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Local API did not become healthy on port 3002");
}

async function withApi(fn) {
  if (await healthy()) {
    console.log("[qa:full] Existing local API is healthy; using it for smoke suites.");
    await fn();
    return;
  }

  console.log("[qa:full] Starting local API for smoke suites.");
  const child = spawn(process.execPath, ["apps/api/dist/index.js"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...qaEnv, PORT: "3002", NODE_ENV: "development" },
  });
  const kill = () => {
    if (child.pid && !child.killed) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", shell: true });
      } else {
        child.kill("SIGTERM");
      }
    }
  };
  try {
    await waitForApi();
    await fn();
  } finally {
    kill();
  }
}

run("API build", ["--prefix", "apps/api", "run", "build"]);
run("API tests", ["--prefix", "apps/api", "run", "test"]);
run("Web lint", ["--prefix", "apps/web", "run", "lint"]);
await withApi(async () => {
  run("Web build", ["--prefix", "apps/web", "run", "build"]);
  run("Public E2E", ["--prefix", "apps/web", "run", "test:e2e:public"]);
});
run("Integration E2E local", ["run", "test:e2e:integration:local"]);

await withApi(async () => {
  run("API smoke:prod", ["--prefix", "apps/api", "run", "smoke:prod"], { ...qaEnv, SMOKE_API_URL: localApi });
  run("API smoke:suite", ["--prefix", "apps/api", "run", "smoke:suite"], { ...qaEnv, SMOKE_API_URL: localApi });
  run("API smoke:roles-deep", ["--prefix", "apps/api", "run", "smoke:roles-deep"], { ...qaEnv, SMOKE_API_URL: localApi });
});

console.log("\n[qa:full] OK");
