import { expect, test } from "@playwright/test";
import { SEED_USERS } from "./fixtures/seed-users";
import { isApiHealthy } from "./helpers/api-health";
import { loginViaUi } from "./helpers/login";

/**
 * @integration
 */
test.describe("Bildirim zili ve merkez @integration", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await isApiHealthy(request)),
      "API ayakta değil (GET .../health).",
    );
  });

  test("öğrenci: bildirim zili ve /bildirimler sayfası", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await expect(page).toHaveURL(/\/student\/panel/);

    const bell = page.getByRole("button", { name: /bildirim/i });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByRole("dialog", { name: "Bildirim önizlemesi" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tüm bildirimleri aç" })).toBeVisible();

    await page.goto("/bildirimler");
    await expect(page.getByRole("heading", { name: "Bildirimler", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tümü" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Okunmamış" })).toBeVisible();
  });

  test("öğretmen: kampanya vs talep açıklayıcıları", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.teacher.email, SEED_USERS.teacher.password);
    await expect(page).toHaveURL(/\/teacher/);

    await page.goto("/teacher/requests");
    await expect(page.getByTestId("teacher-flow-explainer-requests")).toBeVisible();
    await expect(page.getByText("Ders talebi = öğrencinin açtığı ilan")).toBeVisible();

    await page.goto("/teacher/kampanyalar");
    await expect(page.getByTestId("teacher-flow-explainer-campaigns")).toBeVisible();
    await expect(page.getByText("Kampanya ilanı = sizin vitrin duyurunuz")).toBeVisible();
  });
});
