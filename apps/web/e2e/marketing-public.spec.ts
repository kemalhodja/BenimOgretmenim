import { expect, test } from "@playwright/test";

/**
 * Kamuya açık vitrin sayfaları — API kapalı olsa da shell yüklenmeli.
 * @public
 */
test.describe("Vitrin ve bilgi sayfaları @public", () => {
  const cases: { path: string; title: string | RegExp }[] = [
    { path: "/", title: "Öğretmen bul, ders al, soru sor ve gelişimini takip et" },
    { path: "/courses", title: "Kurslar" },
    { path: "/ogretmenler", title: "Öğretmen ara" },
    { path: "/fiyatlar", title: "Üyelik ve kullanım bilgileri" },
    { path: "/yardim", title: "Yardım" },
    { path: "/iletisim", title: "İletişim" },
    { path: "/kampanya", title: "İlk 500 öğretmene erken erişim hediyesi" },
    { path: "/kampanyalar", title: "Öğretmen kampanyaları" },
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

  test("/fiyatlar — ziyaretçiye şeffaf temel ücretleri gösterir", async ({ page }) => {
    const res = await page.goto("/fiyatlar", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Üyelik ve kullanım bilgileri" })).toBeVisible();
    await expect(page.getByText(/1750 TL \/ 30 ay/)).toBeVisible();
    await expect(page.getByText(/2500 TL \/ 60 ay/)).toBeVisible();
    await expect(page.getByText(/yıllık 1500 TL/)).toBeVisible();
    await expect(page.getByText(/12\.000 TL/).first()).toBeVisible();
    await expect(page.getByText(/Erken erişim hediyesi/)).toBeVisible();
  });

  test("/kayit — roller platformda bulacaklarını görür", async ({ page }) => {
    const res = await page.goto("/kayit", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Kayıt ol" })).toBeVisible();
    await expect(page.getByText("Bu platformda ne bulacaksınız?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Öğrenci hesabını incele" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Veli hesabını incele" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Öğretmen hesabını incele" })).toBeVisible();
    await expect(page.getByText(/Güvenli ödeme, destek ve sorun çözümünde/)).toBeVisible();
    await page.getByRole("button", { name: "Veli hesabını incele" }).click();
    await expect(page.locator("select").first()).toHaveValue("guardian");
    await expect(page.getByRole("button", { name: "Veli hesabını incele" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Öğretmen hesabını incele" }).click();
    await expect(page.locator("select").first()).toHaveValue("teacher");
    await expect(page.getByText(/profilinizi web siteniz gibi kurup/)).toBeVisible();
  });

  test("/ogretmenler — seçim sihirbazı filtreleri hazırlar", async ({ page }) => {
    const res = await page.goto("/ogretmenler", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByText("Öğretmen seçim sihirbazı")).toBeVisible();
    await page.getByRole("button", { name: "YKS / TYT" }).click();
    await page.getByRole("button", { name: "Bütçeye uygun" }).click();
    await page.getByRole("button", { name: "Saatlik 750 TL altı" }).click();
    await page.getByRole("button", { name: "Önerilen öğretmenleri göster" }).click();
    await expect(page).toHaveURL(/q=TYT\+Matematik/);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/maxHourlyRateMinor=75000/);
  });

  for (const path of ["/ogretmenler", "/courses", "/kampanyalar"]) {
    test(`${path} — CollectionPage JSON-LD parse edilir`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() ?? false).toBeTruthy();
      const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
        nodes.map((node) => JSON.parse(node.textContent ?? "{}") as { "@type"?: string; mainEntity?: unknown }),
      );
      expect(schemas.some((schema) => schema["@type"] === "CollectionPage" && schema.mainEntity)).toBeTruthy();
    });
  }

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

  test("/sitemap.xml — kamu URL envanteri parse edilir", async ({ page }) => {
    const res = await page.goto("/sitemap.xml", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    const xml = await page.locator("body").innerText();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/ogretmenler");
    expect(xml).toContain("/courses");
    expect(xml).toContain("/kampanyalar");
  });
});
