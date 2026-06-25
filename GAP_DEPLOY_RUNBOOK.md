# Gap Plan (Faz 0–3) — Deploy Runbook

Tahta karşı güven, operasyon, ölçek ve dağıtım hazırlığı kodunun production’a alınması.

## 1) Migration (zorunlu)

Render API deploy öncesi veya hemen sonrası:

```bash
npm run db:migrate
```

Yeni dosyalar:

| Migration | İçerik |
|-----------|--------|
| `058_user_account_lifecycle.sql` | `account_status`, askıya alma, KVKK silme talebi |
| `059_faz2_ops_settings_storage_email.sql` | `platform_ops_settings`, `email_outbox`, veli e-posta tercihleri |
| `060_product_vision_gaps.sql` | Ürün vizyonu boşlukları (kurs/grup/ders) |
| `061_ai_trust_performance.sql` | Zigo vitrin, veli kredileri, anlık ders, haftalık rapor tabloları |
| `066_notification_inbox_indexes.sql` | Bildirim inbox okunmamış + dedupe indeksleri |

Deploy `preDeployCommand` migration sonrası `db:seed:zigo` çalıştırır (tablo boşsa demo vitrin; doluysa atlar).

Doğrulama (psql veya admin health):

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'account_status';
SELECT key FROM platform_ops_settings;
SELECT indexname FROM pg_indexes WHERE tablename = 'parent_notifications' AND indexname LIKE '%unread%';
```

## 2) Render env — API

| Değişken | Açıklama |
|----------|----------|
| *(mevcut)* | JWT, PayTR, CORS, ADMIN_API_SECRET |
| `HOMEWORK_STORAGE_DIR` | Ödev görseli disk yolu (Render disk mount) |
| `HOMEWORK_STORAGE_PUBLIC_BASE` | `https://benimogretmenim.com.tr/homework-media` gibi public base |
| `RESEND_API_KEY` | Veli e-posta (opsiyonel; yoksa outbox kuyruğa yazar) |
| `EMAIL_FROM` | `BenimÖğretmenim <noreply@benimogretmenim.com.tr>` |

Otomatik çekim varsayılanı **kapalı** (`autoApproveEnabled: false`); admin `/admin/otomatik-cekim` üzerinden açılır.

Render cron (`render.yaml`):

| Cron | Sıklık | Komut |
|------|--------|--------|
| `benimogretmenim-group-lessons-settle` | 10 dk | `group-lessons:settle` |
| `benimogretmenim-homework-release` | 5 dk | `homework:release-expired` |
| `benimogretmenim-courses-settle-started` | 10 dk | `courses:settle-started` |
| `benimogretmenim-notifications-reminders` | 15 dk | `notifications:reminders` |
| `benimogretmenim-guardian-weekly-reports` | Pazartesi 05:00 UTC | `guardian-weekly-reports:run` |

Blueprint Sync sonrası yeni cron servislerinin Render’da **Active** olduğunu doğrulayın.

## 3) Render env — Web

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SITE_URL` | `https://benimogretmenim.com.tr` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.benimogretmenim.com.tr` |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Play yayın sonrası (opsiyonel) |

## 4) DNS (Turhost)

`DEPLOYMENT.md` bölüm 7 + `SEO_LAUNCH_CHECKLIST.md`.

## 5) Deploy sonrası smoke

```bash
SMOKE_API_URL=https://api.benimogretmenim.com.tr npm run smoke:prod
```

Manuel kontrol:

- [ ] `/guven`, `/iade`, `/itiraz` — 200
- [ ] `/sitemap.xml` — `/iade`, `/itiraz` içeriyor
- [ ] Giriş → `/ayarlar/hesap` (KVKK talebi formu)
- [ ] Admin → `/admin/destek-sla`, `/admin/otomatik-cekim`
- [ ] Öğretmen → `/teacher/cuzdan` SLA metni, `/teacher/dogrulama`
- [ ] Giriş → bildirim zili (`/v1/notifications/summary` 200)
- [ ] Veli → `/guardian#haftalik-ozet` kartı
- [ ] API SSE: `GET /v1/notifications/stream` (girişli, `text/event-stream`)

## 5b) Bildirim / SSE notları

- Tüm yeni `parent_notifications` kayıtları `notifyParentInApp` üzerinden `href`, `priority`, `actionLabel` alır.
- Render/nginx arkasında SSE için API yanıtında `X-Accel-Buffering: no` gönderilir.
- Web `useNotificationInbox` SSE + 60 sn polling yedek kullanır.

## 6) Play / TWA (ayrı adım)

1. `apps/twa-android/RELEASE_CHECKLIST.md`
2. Play SHA-256 → `apps/web/public/.well-known/assetlinks.json`
3. Web redeploy

## 7) Search Console

`SEO_LAUNCH_CHECKLIST.md` — mülk doğrulama + sitemap gönderimi.

---

**Kalan risk:** Migration atlanırsa askıya alma, otomatik çekim ayarları ve e-posta outbox çalışmaz; API hata veya boş ekran verebilir.

Son güncelleme: 2026-06-17
