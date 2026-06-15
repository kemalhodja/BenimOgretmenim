import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const webServerPort = (() => {
  try {
    const url = new URL(baseURL);
    return url.port || (url.protocol === "https:" ? "443" : "80");
  } catch {
    return "3000";
  }
})();

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PORT: process.env.PORT ?? webServerPort,
      HOSTNAME: "127.0.0.1",
      /** Yerel Playwright: build + start için (ci-web.mjs ile uyumlu) */
      WEB_ALLOW_HTTP: process.env.WEB_ALLOW_HTTP ?? "1",
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
    },
  },
});
