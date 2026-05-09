import { expect, test } from "@playwright/test";

/**
 * Oturum yokken korumalı rotaların girişe düşmesi.
 * @public
 */
test.describe("Panel ve korumalı rotalar (oturumsuz) @public", () => {
  const redirectsToLogin: string[] = [
    "/student/panel",
    "/student/requests",
    "/student/dersler",
    "/teacher",
    "/teacher/requests",
    "/guardian",
    "/admin",
    "/admin/users",
  ];

  for (const path of redirectsToLogin) {
    test(`${path} → /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });
  }

  test("/panel kökü → rol bazlı yönlendirme veya login", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
