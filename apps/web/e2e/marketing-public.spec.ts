import { expect, test } from "@playwright/test";

/**
 * Kamuya açık vitrin sayfaları — API kapalı olsa da shell yüklenmeli.
 * @public
 */
test.describe("Vitrin ve bilgi sayfaları @public", () => {
  const cases: { path: string; title: string | RegExp }[] = [
    { path: "/", title: "Öğretmen bulun, talep açın, teklifleri karşılaştırın" },
    { path: "/courses", title: "Kurslar" },
    { path: "/ogretmenler", title: "Öğretmen ara" },
    { path: "/fiyatlar", title: "Abonelik fiyatları" },
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
});
