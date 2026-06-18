# BenimÖğretmenim — Ürün Gap Planı (Tahta karşı)

Tahta şikayetleri ve rekabet analizi sonrası eksiklerin önceliklendirilmiş yol haritası.

## Faz 0 — Güven (Tahta şikayetlerine karşı)

| # | Özellik | Durum | Not |
|---|---------|-------|-----|
| 0.1 | Öğretmen hak ediş özeti API | ✅ | `GET /v1/wallet/earnings-summary` |
| 0.2 | Öğretmen cüzdan SLA UI | ✅ | 5 iş günü taahhüt + tahmini tarih |
| 0.3 | İtiraz (dispute) UI | ✅ | `/itiraz` → `/v1/support/disputes` |
| 0.4 | İade politikası sayfası | ✅ | `/iade` |
| 0.5 | KVKK hesap silme self-service | ✅ | `/ayarlar/hesap` + auth API |
| 0.6 | Askıya alma sebep + bildirim + itiraz | ✅ | migration 058, admin UI, `/hesap-askida` |

**Backend:** `058_user_account_lifecycle.sql`, `accountLifecycle.ts`, `requireAuth` kısıtları, admin `PATCH .../account-status`.

## Faz 1 — Operasyonel netlik

| # | Özellik | Durum | Not |
|---|---------|-------|-----|
| 1.1 | Ödev havuzu SLA istatistikleri UI | ✅ | ödev-sor sayfası banner |
| 1.2 | Bildirim merkezi iyileştirmesi | ✅ | `/bildirimler` + panel link |
| 1.3 | Öğrenci “bugün” kartı (panel) | ✅ | “Bugün ne yapmalıyım?” bölümü |
| 1.4 | Mini deneme (10 soru) | ✅ | `mode=mini` API + çalışma sayfası |
| 1.5 | Güven rozetleri (öğretmen kartı) | ✅ | Güven puanı, doğrulama, doküman rozetleri |

## Faz 2 — Ölçek ve uyum

| # | Özellik | Durum | Not |
|---|---------|-------|-----|
| 2.1 | Otomatik çekim kuralları | ✅ | `/admin/otomatik-cekim`, uygunluk etiketi + toplu onay |
| 2.2 | Öğretmen KYC UI | ✅ | `/teacher/dogrulama`, admin belge linkleri |
| 2.3 | Object storage (ödev görselleri) | ✅ | `HOMEWORK_STORAGE_DIR` + `HOMEWORK_STORAGE_PUBLIC_BASE` |
| 2.4 | Veli e-posta bildirimleri | ✅ | `email_outbox`, Resend, veli tercihleri |
| 2.5 | Destek SLA dashboard | ✅ | `/admin/destek-sla` |

## Faz 3–4 — İçerik ve dağıtım

| # | Özellik | Durum | Not |
|---|---------|-------|-----|
| 3.1 | AI ödev sınıflandırma genişletme | ✅ | `routing_priority`, `needs_clarification`, `content_quality`, `recommended_teacher_tags`; havuz sıralaması |
| 3.2 | SEO / güven sayfaları sitemap | ✅ | `/iade`, `/itiraz` + `SEO_LAUNCH_CHECKLIST.md` |
| 3.3 | Play Store / TWA dokümantasyon | ✅ | `RELEASE_CHECKLIST.md`, `/uygulama` Play bölümü |
| 3.4 | `.com.tr` DNS | ⏳ | Turhost — kullanıcı aksiyonu (`DEPLOYMENT.md`, `SEO_LAUNCH_CHECKLIST.md`) |
| 3.5 | `assetlinks.json` canlı | ⏳ | Play App Signing SHA-256 sonrası deploy |

**Backend:** `homeworkPosts.ts` heuristic_v2, öğretmen havuzu `routing_priority` sıralaması.

**Dağıtım:** Play bireysel hesap rehberi `PLAY_CONSOLE_COMPLIANCE.md`; yayın adımları `apps/twa-android/RELEASE_CHECKLIST.md`.

## Tahta şikayeti → BO karşılığı

| Tahta şikayeti | BO karşılığı |
|----------------|--------------|
| Öğretmen ödeme yapmak zorunda | Öğrenci öder; öğretmen komisyon ödemez |
| Sebepsiz hesap kapatma | Askıya alma gerekçesi + `/hesap-askida` + itiraz |
| Destek yanıt vermiyor | `/admin/destek-sla` + dispute |
| Hesap silinemiyor | `/ayarlar/hesap` KVKK talebi |
| Abonelik/iade belirsiz | `/iade` + cüzdan audit |
| Koçluk zorlaması | Ürün politikası: koçluk satışı yok |

## Sıradaki adım

**Dağıtım (kullanıcı):** Turhost DNS, Search Console sitemap, Play SHA-256 → `assetlinks.json` deploy.

Kontrol listeleri: `SEO_LAUNCH_CHECKLIST.md`, `apps/twa-android/RELEASE_CHECKLIST.md`, `GAP_DEPLOY_RUNBOOK.md`.
