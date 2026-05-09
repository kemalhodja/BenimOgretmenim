import type { Page } from "@playwright/test";

/**
 * Production `next start` ile de çalışır (dev login ön ayar butonları kapalı).
 */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator('input[inputmode="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}
