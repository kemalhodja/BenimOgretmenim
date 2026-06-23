# DNS / www acil düzeltme (canlı teşhis: Haziran 2026)

## Sorun

Şu an:

1. `benimogretmenim.com.tr` → Turhost **301** → `www.benimogretmenim.com.tr`
2. `www.benimogretmenim.com.tr` → **API servisi** (JSON, “REST API sunar” mesajı)
3. API yanıtında `"web":"https://benimogretmenim-web.onrender.com"` görünüyordu (yanlış env)

**Web sitesi açılmıyor** — `www` yanlış Render servisine bağlı.

---

## Doğru yapı

| Host | Render servisi | DNS |
|------|----------------|-----|
| `benimogretmenim.com.tr` | **benimogretmenim-web** | A → `216.24.57.1` (Render apex IP) |
| `www.benimogretmenim.com.tr` | **benimogretmenim-web** | CNAME → Render **web** hedefi |
| `api.benimogretmenim.com.tr` | **benimogretmenim-api** | CNAME → `benim-ogretmenim.onrender.com` |

**Web** hedefi genelde: `benimogretmenim-web.onrender.com` veya Render Dashboard’da web servisi için gösterilen CNAME.

**Asla** `www` → `benimogretmenim.onrender.com` (bu eski/yanlış eşleşme API’ye gidebilir).

---

## Adım 1 — Render Dashboard

### benimogretmenim-api → Settings → Custom Domains

- `www.benimogretmenim.com.tr` varsa **SİLİN** (yanlış serviste)
- Sadece `api.benimogretmenim.com.tr` kalsın

### benimogretmenim-web → Settings → Custom Domains

- `benimogretmenim.com.tr` → **Verified**
- `www.benimogretmenim.com.tr` → **ekleyin**, Verified olana kadar bekleyin

### benimogretmenim-api → Environment

```
PUBLIC_WEB_URL=https://benimogretmenim.com.tr
```

(`benimogretmenim-web.onrender.com` **silin**)

### benimogretmenim-web → Environment

```
NEXT_PUBLIC_SITE_URL=https://benimogretmenim.com.tr
```

---

## Adım 2 — Turhost DNS

DNS Yönetimi:

| Tür | Host | Değer |
|-----|------|--------|
| A | `@` | `216.24.57.1` (Render web apex — Dashboard’da doğrulayın) |
| CNAME | `www` | Render **web** servisinin CNAME’i (ör. `benimogretmenim-web.onrender.com`) |
| CNAME | `api` | `benim-ogretmenim.onrender.com` |

### Turhost “www yönlendirme”

Turhost’ta **apex → www otomatik yönlendirme** açıksa:

- **Kapatın** (tercih: ana adres `benimogretmenim.com.tr`)
- veya önce `www`’yi web servisine doğru bağlayın

---

## Adım 3 — Doğrulama

```powershell
curl.exe -sI "https://benimogretmenim.com.tr/" | findstr /i "HTTP content-type location"
curl.exe -sI "https://www.benimogretmenim.com.tr/" | findstr /i "HTTP content-type location"
curl.exe -s "https://www.benimogretmenim.com.tr/" | Select-Object -First 1
```

Beklenen:

- `content-type: text/html` (JSON değil)
- Ana sayfa HTML (API JSON değil)
- `www` → `308` → `https://benimogretmenim.com.tr` (web deploy sonrası)

---

## Özet

Kod tek başına yetmez: **`www` DNS + Render custom domain web servisinde olmalı, API’de olmamalı.**
