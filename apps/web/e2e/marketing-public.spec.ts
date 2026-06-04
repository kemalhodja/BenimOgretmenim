import { expect, test } from "@playwright/test";

/**
 * Kamuya açık vitrin sayfaları — API kapalı olsa da shell yüklenmeli.
 * @public
 */
test.describe("Vitrin ve bilgi sayfaları @public", () => {
  const cases: { path: string; title: string | RegExp }[] = [
    { path: "/", title: "Ders, soru çözüm ve çalışma takibini tek platformda yönetin" },
    { path: "/courses", title: "Kurslar" },
    { path: "/ogretmenler", title: "Öğretmen ara" },
    { path: "/fiyatlar", title: "Fiyatlandırma ve kullanım akışları" },
    { path: "/yardim", title: "Yardım" },
    { path: "/iletisim", title: "İletişim" },
    { path: "/kampanya", title: "Abonelik kampanyası" },
    { path: "/uygulama", title: "Telefona ekle" },
    { path: "/kayit", title: "Kayıt ol" },
    { path: "/login", title: "Giriş yap" },
    { path: "/gizlilik", title: "Gizlilik ve kişisel veriler" },
    { path: "/kullanim-kosullari", title: "Kullanım koşulları" },
  ];

  for (const { path, title } of cases) {
    test(`${path} — HTTP 200 ve H1`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() ?? false).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    });
  }

  test("/uygulama — rol bazlı hızlı erişimler görünür", async ({ page }) => {
    const res = await page.goto("/uygulama", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Öğrenci hızlı başlangıç" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Soru gönder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Soru havuzu" })).toBeVisible();
  });

  test("/fiyatlar — ziyaretçiye abonelik tutarı göstermez", async ({ page }) => {
    const res = await page.goto("/fiyatlar", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Fiyatlar üyelikten sonra görünür" })).toBeVisible();
    await expect(page.getByText("1750 TL")).toHaveCount(0);
    await expect(page.getByText("2500 TL")).toHaveCount(0);
  });

  test("/manifest.webmanifest — PWA kısayolları güncel", async ({ page }) => {
    const res = await page.goto("/manifest.webmanifest", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    const text = await page.locator("body").innerText();
    const manifest = JSON.parse(text) as { shortcuts?: Array<{ url?: string }> };
    const shortcutUrls = new Set((manifest.shortcuts ?? []).map((item) => item.url));
    expect(shortcutUrls.has("/student/odev-sor")).toBeTruthy();
    expect(shortcutUrls.has("/student/calisma")).toBeTruthy();
    expect(shortcutUrls.has("/teacher/odev-havuzu")).toBeTruthy();
  });
});
