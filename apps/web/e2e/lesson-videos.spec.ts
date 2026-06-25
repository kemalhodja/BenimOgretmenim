import { expect, test } from "@playwright/test";
import { SEED_USERS } from "./fixtures/seed-users";
import { isApiHealthy } from "./helpers/api-health";
import { loginViaUi } from "./helpers/login";

/**
 * Ders videoları — seed öğrenci (grade 8) + seed öğretmen örnek videoları.
 * @integration
 */
test.describe("Ders videoları @integration", () => {
  test.beforeEach(async ({ request }) => {
    test.skip(
      !(await isApiHealthy(request)),
      "API ayakta değil. db:up, migrate, seed, API dev sonra tekrar deneyin.",
    );
  });

  test("öğrenci: sınıfa uygun videoları listeler ve oynatır", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await page.goto("/student/ders-videolari", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("lesson-videos-title")).toBeVisible();
    await expect(page.getByText(/Sınıfınız:/)).toBeVisible();

    const list = page.getByTestId("lesson-videos-list");
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(list.getByRole("button").first()).toBeVisible();

    await page.getByTestId("lesson-videos-kind-chips").getByRole("button", { name: /Sınav hazırlık/ }).click();
    await expect(page.getByTestId("lesson-video-player")).toBeVisible();

    const player = page.getByTestId("lesson-video-player");
    await expect(player.locator("iframe").or(player.getByRole("link", { name: "Videoyu aç" }))).toBeVisible();
  });

  test("öğretmen: video yayınlar ve listede görür", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.teacher.email, SEED_USERS.teacher.password);
    await page.goto("/teacher/ders-videolari", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("teacher-lesson-videos-title")).toBeVisible();

    const title = `E2E Video ${Date.now()}`;
    const form = page.getByTestId("teacher-lesson-video-form");
    await form.getByLabel(/Video başlığı/i).fill(title);
    await form.getByLabel(/^Konu$/i).fill("E2E konu testi");
    await form.getByLabel(/Kazanım kodu/i).fill("M.8.9.9");
    await form.getByLabel(/Kazanım açıklaması/i).fill("E2E kazanım");
    await form.getByLabel(/Video bağlantısı/i).fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await form.getByRole("button", { name: "Yayınla" }).click();

    await expect(page.getByText(/Video gönderildi|Video yayınlandı/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("teacher-lesson-videos-list").getByText(title)).toBeVisible();
  });

  test("öğrenci panel: sınıf eksikse uyarı göstermez (seed grade 8)", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.student.email, SEED_USERS.student.password);
    await page.goto("/student/panel", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Özet", exact: true })).toBeVisible();
    await expect(page.getByTestId("student-grade-missing-banner")).toHaveCount(0);
  });

  test("veli: bağlı öğrencinin videolarını görür", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.guardian.email, SEED_USERS.guardian.password);
    await page.goto("/guardian/ders-videolari", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("guardian-lesson-videos-title")).toBeVisible();
    await expect(page.getByTestId("guardian-student-select")).toBeVisible();
  });
});
