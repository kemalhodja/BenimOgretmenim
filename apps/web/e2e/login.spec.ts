import { expect, test } from "@playwright/test";

test.describe("Giriş", () => {
  test("form alanları görünür", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Giriş" })).toBeVisible();
    await expect(page.locator('input[inputmode="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  });
});
