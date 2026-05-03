import { expect, test } from "@playwright/test";

test.describe("Ana sayfa", () => {
  test("başlık ve ana CTA görünür", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Öğretmen bul");
    await expect(page.locator('a[href="/ogretmenler"]').first()).toBeVisible();
    await expect(page.locator('a[href="/student/requests"]').first()).toBeVisible();
  });
});
