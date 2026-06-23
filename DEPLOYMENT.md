## BenimÖğretmenim — Canlıya Alma (Production)

Bu doküman, monorepo’daki iki servisi prod’a taşımak içindir:

- **API**: `apps/api` (Hono + Node)
- **Web**: `apps/web` (Next.js App Router)

> Not: Repo kökündeki `docker-compose.yml` sadece **PostgreSQL** içindir (uygulama container’ları burada tanımlı değil).

---

## 1) Production zorunlu ENV’ler

### API (`apps/api/.env`)

Şablon: `apps/api/.env.example`

Minimum:
- `DATABASE_URL=postgresql://...` (prod DB)
- `JWT_SECRET=` (**en az 32 karakter**, rastgele)
- `JWT_EXPIRES=7d` (isteğe göre)
- `PORT=3002` (veya reverse proxy arkasında farklı)

Önerilen:
- `CORS_ORIGINS=https://benimogretmenim.com.tr,https://www.benimogretmenim.com.tr`
- `ADMIN_API_SECRET=` (admin proxy uçları için)

PayTR kullanacaksan:
- `PAYTR_*` alanları + `PAYTR_CALLBACK_URL` + `PAYTR_OK_URL` + `PAYTR_FAIL_URL`

### Web (`apps/web/.env.local`)

Şablon: `apps/web/.env.local.example`

Prod için:
- `NEXT_PUBLIC_API_BASE_URL=https://api.benimogretmenim.com.tr`
- `NEXT_PUBLIC_SITE_URL=https://benimogretmenim.com.tr`
- `INTERNAL_API_BASE_URL=https://api.benimogretmenim.com.tr` (server-side route handlers için)
- `ADMIN_API_SECRET=` (tanımlıysa; **tarayıcıya değil**, sadece server’a)

---

## 2) Prod DB hazırlığı

1) Prod Postgres oluştur (Neon/Supabase/VPS)
2) `DATABASE_URL`’yi `apps/api/.env` içine yaz
3) Migration:

```bash
cd apps/api
npm ci
npm run db:migrate
```

Seed:
- Prod’da **seed-dev** genelde çalıştırılmaz. (Sadece kapalı beta için istersen.)

---

## 3) Build & smoke doğrulaması

API build/test:

```bash
cd apps/api
npm ci
npm run build
```

Web build:

```bash
cd apps/web
npm ci
npm run build
```

Smoke (API ayağa kalkınca):

```bash
cd ../..
npm run smoke
```

Prod’da hızlı, **salt-okunur** kontrol (kayıt/para işlemi yapmaz):

```bash
SMOKE_API_URL=https://api.benimogretmenim.com.tr npm run smoke:prod
```

Not: `/health` içindeki `db: true` sadece Postgres’e bağlanabildiğini gösterir. `/v1/meta/*` gibi uçlar
**500 + `internal_error`** ise çoğunlukla **migration uygulanmamış** (tablolar yok) demektir; Render’da API deploy
loglarında `preDeployCommand` (`npm run db:migrate`) çıktısını kontrol edin.

---

## 4) Önerilen dağıtım modeli (VPS + reverse proxy)

### A) API (Node process) + systemd

1) Sunucuda `apps/api` için build al:

```bash
cd /srv/benimogretmenim/apps/api
npm ci
npm run build
```

2) Çalıştır:

```bash
PORT=3002 node dist/index.js
```

3) Nginx/Caddy ile `https://api.sizin-domain.com` → `http://127.0.0.1:3002` proxy.

### B) Web (Next start) + systemd

```bash
cd /srv/benimogretmenim/apps/web
npm ci
npm run build
PORT=3000 npm run start
```

Nginx/Caddy ile `https://web.sizin-domain.com` → `http://127.0.0.1:3000` proxy.

---

## 5) Minimum canlı kontrol listesi (go/no-go)

- **API**: `GET /health` 200 ve `db: true`
- **Web**: ana sayfa açılıyor, header/logo görünüyor
- **Auth**: kayıt + giriş
- **Öğrenci**: ders talebi oluşturma
- **Öğretmen**: talebe teklif verme (aboneliği yoksa 300 TL fee)
- **Cüzdan**: bakiye görüntüleme
- **Grup ders**: join kapanışı + settle job (cron/worker)

---

## 6) Cron/Job (grup ders settle)

Prod’da her 5–10 dakikada bir çalıştırmanız yeterli:

```bash
cd /srv/benimogretmenim/apps/api
npm run group-lessons:settle
```

Cron örneği:
- `*/10 * * * * cd /srv/benimogretmenim/apps/api && npm run -s group-lessons:settle`

### Render (Blueprint / Dashboard)

Repo kökündeki `render.yaml` içinde **`type: cron`** ile aynı iş planlanır: `apps/api` altında
`npm run -s group-lessons:settle` ve `DATABASE_URL` Postgres instance’dan gelir.

Blueprint’i daha önce manuel servislerle oluşturduysanız, yeni Cron servisini Render’da
**Blueprint Sync** ile ekleyin veya Dashboard’dan Cron Job oluşturup komutu birebir verin.

---

## 7) `benimogretmenim.com.tr` — Render + DNS

Canlı adresler:

| Servis | URL |
|--------|-----|
| Web | `https://benimogretmenim.com.tr` |
| API | `https://api.benimogretmenim.com.tr` |

### Render Custom Domain

1. **benimogretmenim-web** → Settings → Custom Domains → `benimogretmenim.com.tr` ve `www.benimogretmenim.com.tr`
2. **benimogretmenim-api** → Settings → Custom Domains → `api.benimogretmenim.com.tr`
3. Render’ın verdiği DNS kayıtlarını alan adı sağlayıcınıza ekleyin (genelde `CNAME` veya apex için `A`/`ALIAS`).

`www` adım adım: **`apps/web/WWW_SETUP.md`**

### Alan adı sağlayıcısı (örnek kayıtlar)

- `@` (apex) → Render web için verilen kayıt
- `www` → Render web (veya web’de `www` → apex yönlendirmesi; repo `proxy.ts` www’yi apex’e 308 ile yönlendirir)
- `api` → Render API için verilen `CNAME`

#### Turhost (benimogretmenim.com.tr)

1. [Turhost](https://www.turhost.com) → Alan adları → **DNS Yönetimi** (nameserver: `dns1.turhost.com`, `dns2.turhost.com`).
2. Önce Render Dashboard’da custom domain ekleyin; Render’ın gösterdiği değerleri kullanın.
3. Tipik kayıtlar (park sayfası / eski `AAAA` kayıtlarını silin):

| Tür | Host | Değer |
|-----|------|--------|
| A | `@` | `216.24.57.1` (Render apex IP — Dashboard’da doğrulayın) |
| CNAME | `www` | `benimogretmenim.onrender.com` |
| CNAME | `api` | `benim-ogretmenim.onrender.com` |

4. Yayılım 5–60 dk sürebilir. Kontrol: `nslookup benimogretmenim.com.tr 8.8.8.8` ve `https://api.benimogretmenim.com.tr/health`.
5. Render’da her custom domain yanında **Verified** görünene kadar bekleyin.

### Render Dashboard env (deploy sonrası kontrol)

**API** (`benimogretmenim-api`):

- `CORS_ORIGINS` = `https://benimogretmenim.com.tr,https://www.benimogretmenim.com.tr,https://benimogretmenim.onrender.com`
- `PAYTR_CALLBACK_URL` = `https://api.benimogretmenim.com.tr/v1/paytr/callback`
- `PAYTR_OK_URL` = `https://benimogretmenim.com.tr/odeme/ok`
- `PAYTR_FAIL_URL` = `https://benimogretmenim.com.tr/odeme/hata`

**Web** (`benimogretmenim-web`):

- `NEXT_PUBLIC_SITE_URL` = `https://benimogretmenim.com.tr`
- `NEXT_PUBLIC_API_BASE_URL` = `https://api.benimogretmenim.com.tr`
- `INTERNAL_API_BASE_URL` = `https://api.benimogretmenim.com.tr`

`render.yaml` bu değerleri içerir; mevcut serviste Blueprint Sync veya elle güncelleme gerekebilir.

### Geçiş ve SEO

- Eski `benimogretmenim.onrender.com` adresi web’de otomatik olarak `https://benimogretmenim.com.tr` adresine **308** yönlendirilir.
- Google Search Console’da yeni mülk ekleyin; sitemap: `https://benimogretmenim.com.tr/sitemap.xml`
- Güven URL’leri sitemap’te: `/guven`, `/iade`, `/itiraz` — ayrıntılı kontrol: `SEO_LAUNCH_CHECKLIST.md`
- Android TWA: `https://benimogretmenim.com.tr/.well-known/assetlinks.json` canlı ve Play imza parmak iziyle eşleşmeli (`apps/twa-android/RELEASE_CHECKLIST.md`)

### Go/no-go (domain)

- `https://benimogretmenim.com.tr` açılıyor, logo ve ana sayfa OK
- `https://api.benimogretmenim.com.tr/health` → `db: true`
- Kayıt/giriş ve bir API çağrısı (ör. öğretmen listesi) CORS hatası vermiyor
- PayTR test ödemesi OK/FAIL sayfalarına yeni domain ile dönüyor

### PayTR (API açılmıyorsa)

API production boot sırasında PayTR env eksikse hata verir. İki yol:

**A) Canlı ödeme (önerilen)** — Render → `benimogretmenim-api` → Environment:

- `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` (PayTR mağaza paneli)
- `PAYTR_BASE_URL` = `https://www.paytr.com`
- `PAYTR_CALLBACK_URL` = `https://api.benimogretmenim.com.tr/v1/paytr/callback`
- `PAYTR_OK_URL` = `https://benimogretmenim.com.tr/odeme/ok`
- `PAYTR_FAIL_URL` = `https://benimogretmenim.com.tr/odeme/hata`
- `PAYTR_OPTIONAL` değişkenini **silin** veya `0` yapın

PayTR panelinde callback URL aynı olmalı.

**B) Geçici — ödeme hariç açılış** — `PAYTR_OPTIONAL=1` (repo `render.yaml` varsayılanı). Site ve API açılır; kart ödemesi çalışmaz. Merchant bilgileri girilince `PAYTR_OPTIONAL` kaldırın.

