import { expect, test } from "@playwright/test";
import { SEED_USERS } from "./fixtures/seed-users";
import { isApiHealthy } from "./helpers/api-health";
import { loginViaUi } from "./helpers/login";

/**
 * Gerçek API + seed kullanıcıları gerekir:
 * - PostgreSQL, migrate, `npm run db:seed` (roller)
 * - `npm run db:seed:admin` (bootstrap admin için)
 * - API: http://127.0.0.1:3002
 *
 * @integration
 */
test.describe("Uçtan uca oturum akışları @integration", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await isApiHealthy(request)),
      "API ayakta değil (GET .../health). Örn: db:up, migrate, seed, sonra apps/api dev.",
    );
  });

  test("öğrenci: giriş → öğrenci özet", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await expect(page).toHaveURL(/\/student\/panel/);
    await expect(page.getByRole("heading", { name: "Özet", exact: true })).toBeVisible();
    await expect(page.getByTestId("quick-start-banner")).toBeVisible();
    await expect(page.getByText("Şimdi ne yapmalısınız?")).toBeVisible();
    await page.getByTestId("panel-mode-detailed").click();
    await expect(page.getByText("Başarı paneli")).toBeVisible();
    await expect(page.getByText("Haftalık plan")).toBeVisible();
    await page.goto("/student/calisma");
    await expect(page.getByText("Kazanım testleri", { exact: true })).toBeVisible();
    await expect(page.getByText("20 soruluk ünite kontrolü")).toBeVisible();
    await page.goto("/student/kurslar");
    await expect(page.getByText("Kurs kampanyası ön kayıtları")).toBeVisible();
    await expect(page.getByText("Başvuru durumlarınız")).toBeVisible();
  });

  test("oturum: login sonrası JWT localStorage'a yazılmaz, cookie ile panel yönlendirme çalışır", async ({ page, context }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await expect(page).toHaveURL(/\/student\/panel/);

    const storedToken = await page.evaluate(() => window.localStorage.getItem("bo:token"));
    const cachedRole = await page.evaluate(() => window.localStorage.getItem("bo:role"));
    expect(storedToken).toBeNull();
    expect(cachedRole).toBe("student");

    const cookies = await context.cookies();
    expect(cookies.some((cookie) => cookie.name === "bo_session" && cookie.httpOnly)).toBeTruthy();
    expect(cookies.some((cookie) => cookie.name === "bo_csrf" && !cookie.httpOnly)).toBeTruthy();

    await page.goto("/panel");
    await expect(page).toHaveURL(/\/student\/panel/);
  });

  test("mobil öğrenci: alt navigasyon tek elle temel akışları gösterir", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobil alt nav sadece mobile-chrome projesinde doğrulanır.");
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    const nav = page.getByRole("navigation", { name: "Mobil hızlı gezinme" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Özet" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Talepler" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Çalışma" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Kurslar" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ödev" })).toBeVisible();
  });

  test("mobil öğretmen: alt ikon menüsü öncelikli işleri gösterir", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobil alt nav sadece mobile-chrome projesinde doğrulanır.");
    await loginViaUi(page, SEED_USERS.teacher.email, SEED_USERS.teacher.password);
    const nav = page.getByRole("navigation", { name: "Mobil hızlı gezinme" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Öğretmen ders talepleri" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Öğretmen dersleri" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Öğretmen profili" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Öğretmen cüzdanı" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Öğretmen menüsü" })).toBeVisible();
    await expect(nav.locator("svg")).toHaveCount(5);
  });

  test("öğretmen: giriş → panel özeti", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.teacher.email, SEED_USERS.teacher.password);
    await expect(page).toHaveURL(/\/teacher\/?$/);
    await expect(page.getByRole("heading", { name: "Panel özeti" })).toBeVisible();
    await expect(page.getByText("Öğretmen kalite programı")).toBeVisible();
    await expect(page.getByText("Kazanç ve görünürlük içgörüsü")).toBeVisible();
    await page.goto("/teacher/edit");
    await expect(page.getByText("Profil web sitesi hazırlığı")).toBeVisible();
    await expect(page.getByText("Öğretmen profiliniz artık kişisel web siteniz gibi çalışır")).toBeVisible();
    await page.goto("/teacher/kurslar");
    await expect(page.getByText("Admin kurs kampanyaları")).toBeVisible();
    await expect(page.getByText("Eğitmen başvurusu bekleyen kampanyalar")).toBeVisible();
  });

  test("public öğretmen profili: kişisel web sitesi bölümleri görünür", async ({ page, request }) => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3002";
    const list = await request.get(`${apiBase}/v1/teachers?limit=5&sort=recommended`);
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as { teachers?: Array<{ id?: string }> };
    let teacherId: string | undefined;
    for (const candidate of body.teachers ?? []) {
      if (typeof candidate.id !== "string") continue;
      const detail = await request.get(`${apiBase}/v1/teachers/${candidate.id}`);
      if (!detail.ok()) continue;
      const payload = (await detail.json()) as { teacher?: { has_active_subscription?: boolean } };
      if (payload.teacher?.has_active_subscription !== false) {
        teacherId = candidate.id;
        break;
      }
    }
    test.skip(!teacherId, "Seed öğretmen bulunamadı.");

    await page.goto(`/ogretmenler/${teacherId}`);
    await expect(page).toHaveURL(/\/ogretmenler\/.+-[0-9a-f-]{36}/);
    await expect(page).toHaveTitle(/BenimÖğretmenim|·/);
    await expect(page.getByRole("heading", { name: /güvenli başlangıç|güvenli ders akışı|özel ders/i })).toBeVisible();
    await expect(page.getByText("Kişisel web sayfası")).toBeVisible();
    await expect(page.getByText("Tanıtım paketi")).toBeVisible();
    await expect(page.getByText("Sonuç odaklı ders planı")).toBeVisible();
    await expect(page.getByText("Sadece ilan değil, yönetilen ders süreci")).toBeVisible();
    await expect(page.getByRole("link", { name: /Demo ders talep et|Demo talep et/ }).first()).toBeVisible();
    await expect(page.getByText("Sık sorulan sorular")).toBeVisible();
    const graphSchemas = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) =>
      nodes
        .map((node) => JSON.parse(node.textContent ?? "{}") as { "@graph"?: Array<{ "@type"?: string }> })
        .filter((schema) => Array.isArray(schema["@graph"])),
    );
    expect(graphSchemas.some((schema) => schema["@graph"]?.some((item) => item["@type"] === "Person"))).toBeTruthy();
  });

  test("veli: giriş → veli paneli", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.guardian.email, SEED_USERS.guardian.password);
    await expect(page).toHaveURL(/\/guardian/);
    await expect(page.getByRole("heading", { name: "Veli paneli" })).toBeVisible();
    await expect(page.getByText("Haftalık veli raporu")).toBeVisible();
    await expect(page.getByText("Ders katılımını kontrol et")).toBeVisible();
    await expect(page.getByText("Kazanım testi takibi")).toBeVisible();
  });

  test("yönetici (bootstrap): giriş → admin özet", async ({ page }) => {
    await loginViaUi(
      page,
      SEED_USERS.adminBootstrap.email,
      SEED_USERS.adminBootstrap.password,
    );
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "Özet" }).first()).toBeVisible();
    await page.goto("/admin/merkez");
    await expect(page.getByRole("heading", { name: "Kontrol merkezi" })).toBeVisible();
    await expect(page.getByText("Haftalık ürün kalite raporu").or(page.getByText("Haftalık ürün kalite raporu hazırlanamadı"))).toBeVisible();
    await page.goto("/admin/courses");
    await expect(page.getByText("Admin kurs kampanyası")).toBeVisible();
    await expect(page.getByText("Öğrenci ön kayıtlı, öğretmen başvurulu kurs aç")).toBeVisible();
  });
});
