# DNS / www acil düzeltme

Son canlı kontrol: Haziran 2026

## Şu an ne oluyor?

| Adres | Sonuç |
|-------|--------|
| `benimogretmenim.com.tr` | Turhost **301** → `www` |
| `www.benimogretmenim.com.tr` | **API JSON** (`Content-Type: application/json`) |
| `benimogretmenim.onrender.com` | **Web** (Next.js — doğru servis) |
| `benim-ogretmenim.onrender.com` | **API** |
| `benimogretmenim-web.onrender.com` | 404 (kullanmayın) |

DNS: `www` → `benimogretmenim.onrender.com` (CNAME zinciri doğru **hedefe** gidiyor olabilir).

Asıl hata: Render’da **`www.benimogretmenim.com.tr` custom domain API servisine** bağlı.

**Geçici kod köprüsü (deploy sonrası):** API, `www` isteklerini `benimogretmenim.onrender.com` web servisine proxy’ler — site açılır. Kalıcı çözüm yine Render’da www’yi web servisine taşımak (`scripts/render-fix-domains.mjs` + `RENDER_API_KEY`).

**Döngü uyarısı:** Turhost apex→www açıkken API veya web’den www→apex yönlendirme **yapmayın** — sonsuz redirect oluşur. Önce Render’da www’yi web servisine taşıyın; Turhost yönlendirmesini kapatın veya www’yi birincil bırakın.

---

`render.yaml` güncellendi:

- **benimogretmenim-web:** `benimogretmenim.com.tr`, `www.benimogretmenim.com.tr`
- **benimogretmenim-api:** yalnızca `api.benimogretmenim.com.tr`

Push sonrası Blueprint sync veya manuel deploy ile domainler doğru servise bağlanmalı.

**Otomatik (GitHub):** Repo → Settings → Secrets → `RENDER_API_KEY` ekleyin → Actions → **Render sync domains** → Run workflow.

### A) benimogretmenim-api

1. [Render Dashboard](https://dashboard.render.com) → **benimogretmenim-api**
2. **Settings** → **Custom Domains**
3. `www.benimogretmenim.com.tr` varsa → **Delete** / kaldır
4. Sadece şunlar kalsın: `api.benimogretmenim.com.tr` (ve isteğe bağlı `benim-ogretmenim.onrender.com`)

**Environment** (Settings → Environment):

| Key | Değer |
|-----|--------|
| `PUBLIC_WEB_URL` | `https://benimogretmenim.com.tr` |
| `CORS_ORIGINS` | `https://benimogretmenim.com.tr,https://www.benimogretmenim.com.tr` |

(`benimogretmenim-web.onrender.com` veya `*.onrender.com` **olmasın**)

Kaydet → **Manual Deploy** (gerekirse).

---

### B) benimogretmenim-web

1. **benimogretmenim-web** → **Settings** → **Custom Domains**
2. **Add** → `www.benimogretmenim.com.tr`
3. `benimogretmenim.com.tr` zaten **Verified** olmalı; değilse ekleyin
4. İkisi de **Verified** olana kadar bekleyin (5–30 dk)

**Environment:**

| Key | Değer |
|-----|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://benimogretmenim.com.tr` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.benimogretmenim.com.tr` |
| `INTERNAL_API_BASE_URL` | `https://api.benimogretmenim.com.tr` |

---

### C) Test (Render adımından hemen sonra)

PowerShell:

```powershell
curl.exe -sI "https://www.benimogretmenim.com.tr/" | findstr /i "HTTP content-type location"
curl.exe -s "https://www.benimogretmenim.com.tr/" | Select-Object -First 1
```

Beklenen:

- `content-type: text/html` (JSON değil)
- İlk satır `<!DOCTYPE html>` veya `<html`

Hâlâ JSON ise: API’de `www` custom domain silinmemiş veya DNS yayılımı — 10 dk bekleyip tekrar deneyin.

---

## Adım 2 — Turhost DNS (Render Verified olduktan sonra)

[Turhost](https://www.turhost.com) → Alan adları → **DNS Yönetimi**

| Tür | Host | Değer | Not |
|-----|------|--------|-----|
| **A** | `@` | `216.24.57.1` | Render web apex (Dashboard’da doğrulayın) |
| **CNAME** | `www` | `benimogretmenim.onrender.com` | Render **web** servisinin gösterdiği CNAME |
| **CNAME** | `api` | `benim-ogretmenim.onrender.com` | API |

**Silin / değiştirmeyin:** `www` → API veya başka onrender host.

### Turhost “www yönlendirme” / “alan adını www’ye yönlendir”

**Kapatın** — apex (`benimogretmenim.com.tr`) doğrudan site açsın.

Şu an apex → www **301** veriyor; bu Turhost panel ayarından gelir.

---

## Adım 3 — Son doğrulama

```powershell
curl.exe -sI "https://benimogretmenim.com.tr/" | findstr /i "HTTP content-type location"
curl.exe -sI "https://www.benimogretmenim.com.tr/" | findstr /i "HTTP content-type location"
curl.exe -sI "https://api.benimogretmenim.com.tr/health" | findstr /i "HTTP content-type"
```

| URL | Beklenen |
|-----|----------|
| `benimogretmenim.com.tr` | 200 veya Turhost 301 → www, sonunda `text/html` |
| `www...` | 200, `text/html` (JSON değil) |
| `api.../health` | 200, `application/json`, `"db":true` |

**Not:** Web proxy artık `www` → apex yönlendirmesi yapmaz (Turhost apex→www ile döngü önlenir).

---

## Kontrol listesi

- [ ] API’den `www` custom domain kaldırıldı
- [ ] Web’e `www` custom domain eklendi (Verified)
- [ ] `PUBLIC_WEB_URL` = `https://benimogretmenim.com.tr`
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://benimogretmenim.com.tr`
- [ ] Turhost apex→www yönlendirme kapatıldı
- [ ] `curl www` → HTML, JSON değil

Render adımını bitirince terminalde test komutunu tekrar çalıştırın; sonucu paylaşın.
