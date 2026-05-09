# Playwright E2E — senaryo kataloğu

## Katmanlar

| Katman | Ne işe yarar | Komut (apps/web) |
|--------|----------------|------------------|
| **@public** | Vitrin sayfaları, oturumsuz panel koruması, login formu — **API şart değil** | `npm run test:e2e:public` |
| **@integration** | Seed kullanıcılarla gerçek giriş — **API + DB + seed şart** | `npm run test:e2e:integration` |
| **Tam paket** | Hepsi | `npm run test:e2e` |

Kök dizinden: `npm run test:e2e --prefix apps/web` (veya `test:e2e:public` için aynı kalıp).

## Önkoşullar

### Sadece @public

- `apps/web` için ortam: `WEB_ALLOW_HTTP=1`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL` (Playwright `webServer` varsayılanları yerelde `127.0.0.1` kullanır).
- Playwright `npm run start` ile üretim sunucusunu kaldırır; önce `next build` koşar.

### @integration (oturum akışları)

1. PostgreSQL + `npm run db:migrate --prefix apps/api`
2. `npm run db:seed --prefix apps/api` (öğrenci/öğretmen/veli)
3. `npm run db:seed:admin --prefix apps/api` (bootstrap admin: `admin@benimogretmenim.local`)
4. API ayakta: `http://127.0.0.1:3002` (`GET /health` → 200)

Parolalar `e2e/fixtures/seed-users.ts` ile `login` sayfasındaki seed notlarıyla uyumludur.

## Uçtan uca senaryo özeti

### Oturumsuz (@public)

| ID | Senaryo | Beklenti |
|----|---------|----------|
| P-HOME | `/` | Hero H1 ve öğretmenler / panel linkleri |
| P-LOGIN | `/login` | “Giriş yap” başlığı ve form kontrolleri |
| P-VITRIN | `/courses` … `/kullanim-kosullari` | HTTP 200 + doğru H1 |
| P-GUARD | `/student/panel`, `/teacher`, `/admin`, … | Oturum yok → `/login` |

### Oturumlu (@integration)

| ID | Rol | Adımlar | Beklenti |
|----|-----|---------|----------|
| I-STU | Öğrenci | Login → varsayılan yönlendirme | `/student/panel`, “Özet” |
| I-TCH | Öğretmen | Login | `/teacher`, “Panel özeti” |
| I-GUA | Veli | Login | `/guardian`, “Veli paneli” |
| I-ADM | Admin | Bootstrap hesap | `/admin`, “Özet” |

## API doğrulama (Playwright dışı)

Sunucu tarafı regresyon için monorepo kökünde:

- `npm run smoke:suite` — geniş REST doğrulaması
- `npm run smoke:e2e` — prod-safe kayıt/giriş akışı (ödeme yok)

## CI (GitHub Actions)

`.github/workflows/web-playwright.yml` PR’larda **`npm run test:e2e:public`** çalıştırır (PostgreSQL veya yerel API gerektirmez). Tam oturum paketi için pipeline’a servis konteynerleri eklenene kadar **`test:e2e:integration`** yalnızca yerelde veya özel bir job’da koşturulmalıdır.

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|-----------|
| `PLAYWRIGHT_BASE_URL` | Web kökü (varsayılan `http://127.0.0.1:3000`) |
| `PLAYWRIGHT_API_HEALTH_URL` | Health URL (varsayılan API kökü + `/health`) |
| `SKIP_INTEGRATION_E2E` | CI’da kullanılmıyor; yerine `--grep-invert @integration` tercih edin |
