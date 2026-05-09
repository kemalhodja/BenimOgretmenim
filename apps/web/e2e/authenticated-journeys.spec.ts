import { expect, test } from "@playwright/test";
import { SEED_USERS } from "./fixtures/seed-users";
import { isApiHealthy } from "./helpers/api-health";
import { loginViaUi } from "./helpers/login";

/**
 * Gerçek API + seed kullanıcıları gerekir:
 * - PostgreSQL, migrate, `npm run db:seed` (roller)
 * - `npm run db:seed:admin` (bootstrap admin için)
 * - API: http://127.0.0.1:3002
 *
 * @integration
 */
test.describe("Uçtan uca oturum akışları @integration", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await isApiHealthy(request)),
      "API ayakta değil (GET .../health). Örn: db:up, migrate, seed, sonra apps/api dev.",
    );
  });

  test("öğrenci: giriş → öğrenci özet", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await expect(page).toHaveURL(/\/student\/panel/);
    await expect(page.getByRole("heading", { name: "Özet", exact: true })).toBeVisible();
  });

  test("öğretmen: giriş → panel özeti", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.teacher.email, SEED_USERS.teacher.password);
    await expect(page).toHaveURL(/\/teacher\/?$/);
    await expect(page.getByRole("heading", { name: "Panel özeti" })).toBeVisible();
  });

  test("veli: giriş → veli paneli", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.guardian.email, SEED_USERS.guardian.password);
    await expect(page).toHaveURL(/\/guardian/);
    await expect(page.getByRole("heading", { name: "Veli paneli" })).toBeVisible();
  });

  test("yönetici (bootstrap): giriş → admin özet", async ({ page }) => {
    await loginViaUi(
      page,
      SEED_USERS.adminBootstrap.email,
      SEED_USERS.adminBootstrap.password,
    );
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "Özet" }).first()).toBeVisible();
  });
});
