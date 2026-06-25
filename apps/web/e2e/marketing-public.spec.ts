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
    { path: "/yardim", title: "Yardım" },
    { path: "/roller", title: "Kim ne yapabilir?" },
    { path: "/iletisim", title: "İletişim" },
    { path: "/kampanya", title: "İlk 500 öğretmene erken erişim hediyesi" },
    { path: "/kampanyalar", title: "Öğretmen kampanyaları" },
    { path: "/uygulama", title: "Telefona ekle" },
    { path: "/kayit", title: "Kayıt ol" },
    { path: "/login", title: "Giriş yap" },
    { path: "/gizlilik", title: "Gizlilik ve kişisel veriler" },
    { path: "/kullanim-kosullari", title: "Kullanım koşulları" },
    { path: "/guven", title: /BenimÖğretmenim'de ödeme, öğretmen seçimi ve ders süreci kayıtlı ilerler\./ },
    { path: "/iade", title: "İade politikası" },
    { path: "/itiraz", title: "İtiraz ve anlaşmazlık" },
  ];

  for (const { path, title } of cases) {
    test(`${path} — HTTP 200 ve H1`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() ?? false).toBeTruthy();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    });
  }

  test("/itiraz — oturumsuz bilgi sayfası ve giriş CTA", async ({ page }) => {
    await page.goto("/itiraz", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/itiraz$/);
    const cta = page.getByTestId("itiraz-login-cta");
    await expect(cta).toBeVisible();
    await expect(cta.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  });

  test("/uygulama — oturumsuz tüm rol önizlemeleri görünür", async ({ page }) => {
    const res = await page.goto("/uygulama", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByTestId("uygulama-role-sections")).toBeVisible();
    await expect(page.getByTestId("uygulama-quick-access-student")).toBeVisible();
    await expect(page.getByTestId("uygulama-quick-access-teacher")).toBeVisible();
    await expect(page.getByTestId("uygulama-quick-access-guardian")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Öğrenci hızlı başlangıç" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap — size özel görünüm" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yönetim hızlı erişim" })).toHaveCount(0);
  });

  test("/ — oturumsuz üst menüde Panel yok, Giriş yap var", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("visitor-start-guide")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap" }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Panel", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /kayıt ol/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Roller" }).first()).toBeVisible();
    await expect(page.getByTestId("zigo-teacher-feed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Öğretmen ipuçları" })).toBeVisible();
  });

  test("/fiyatlar — oturumsuz fiyat sayfası ve kayıt CTA", async ({ page }) => {
    const res = await page.goto("/fiyatlar", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Üyelik ve kullanım bilgileri" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Öğrenci olarak başla/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Öğretmen/i }).first()).toBeVisible();
  });

  test("rol özellik listesi — ana sayfa, kayıt, yardim ve roller", async ({ page }) => {
    for (const path of ["/", "/kayit", "/yardim", "/roller"]) {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.ok() ?? false).toBeTruthy();
      await expect(page.getByText(/Tüm özellikler \(\d+\)/).first()).toBeVisible();
      await expect(page.getByText(/Ders talebinde öğretmen kısa listesi/).first()).toBeVisible();
    }
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
    await expect(page.getByText("Abonelikle açılanlar").first()).toBeVisible();
    await expect(page.getByText(/Sınırsız teklif; abonesizken/).first()).toBeVisible();
  });

  test("/ogretmenler — seçim sihirbazı filtreleri hazırlar", async ({ page }) => {
    const res = await page.goto("/ogretmenler", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByText("Öğretmen seçmeme yardım et")).toBeVisible();
    await expect(page.getByText("Hedefinize göre filtreleri hazırlayalım")).toBeVisible();
    await page.getByRole("button", { name: "YKS / TYT" }).click();
    await page.getByRole("button", { name: "Bütçeye uygun" }).click();
    await page.getByRole("button", { name: "Saatlik 750 TL altı" }).click();
    await page.getByRole("button", { name: "Önerilen öğretmenleri göster" }).click();
    await expect(page).toHaveURL(/q=TYT\+Matematik/);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/maxHourlyRateMinor=75000/);
    await expect(page.getByTestId("zigo-teacher-feed")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Öğretmen ipuçları" })).toBeVisible();
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

  test("/guven — iade ve itiraz bağlantıları görünür", async ({ page }) => {
    const res = await page.goto("/guven", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    await expect(page.getByRole("link", { name: /İade politikası/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /İtiraz/i })).toBeVisible();
  });

  test("/sitemap.xml — kamu URL envanteri parse edilir", async ({ page }) => {
    const res = await page.goto("/sitemap.xml", { waitUntil: "domcontentloaded" });
    expect(res?.ok() ?? false).toBeTruthy();
    const xml = await page.locator("body").innerText();
    expect(xml).toContain("<urlset");
    expect(xml).toContain("/ogretmenler");
    expect(xml).toContain("/courses");
    expect(xml).toContain("/kampanyalar");
    expect(xml).toContain("/iade");
    expect(xml).toContain("/itiraz");
    expect(xml).toContain("/guven");
    expect(xml).toContain("/roller");
  });
});
