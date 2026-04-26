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
- `CORS_ORIGINS=https://web.sizin-domain.com,https://sizin-domain.com`
- `ADMIN_API_SECRET=` (admin proxy uçları için)

PayTR kullanacaksan:
- `PAYTR_*` alanları + `PAYTR_CALLBACK_URL` + `PAYTR_OK_URL` + `PAYTR_FAIL_URL`

### Web (`apps/web/.env.local`)

Şablon: `apps/web/.env.local.example`

Prod için:
- `NEXT_PUBLIC_API_BASE_URL=https://api.sizin-domain.com`
- `NEXT_PUBLIC_SITE_URL=https://web.sizin-domain.com`
- `INTERNAL_API_BASE_URL=https://api.sizin-domain.com` (server-side route handlers için)
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

