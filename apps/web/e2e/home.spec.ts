import { expect, test } from "@playwright/test";

test.describe("Ana sayfa @public", () => {
  test("başlık ve ana CTA görünür", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ders, soru çözüm");
    await expect(page.getByRole("link", { name: "Öğrenci olarak başla" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Öğretmenleri keşfet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "En hızlı başlangıç" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Platformda neler var?" })).toBeVisible();
  });

  test("hızlı öğretmen arama hunisi query ile listeye gider", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Ders veya sınav ara").fill("LGS Matematik");
    await page.getByRole("button", { name: "Ara" }).click();
    await expect(page).toHaveURL(/\/ogretmenler\?q=LGS\+Matematik/);
    await expect(page.getByRole("heading", { level: 1, name: "Öğretmen ara" })).toBeVisible();
  });

  test("rol bazlı başlangıç kartları kayıt akışına bağlı", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Öğrenci hesabı aç" })).toHaveAttribute("href", "/kayit?role=student");
    await expect(page.getByRole("link", { name: "Öğretmen başvurusu", exact: true })).toHaveAttribute(
      "href",
      "/kayit?role=teacher",
    );
    await expect(page.getByRole("link", { name: "Veli hesabı aç" })).toHaveAttribute("href", "/kayit?role=guardian");
  });
});
