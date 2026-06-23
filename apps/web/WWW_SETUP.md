# www.benimogretmenim.com.tr — Kurulum

Ana adres (canonical): **https://benimogretmenim.com.tr**  
`www` → apex **308** yönlendirmesi `apps/web/proxy.ts` içinde hazır.

TWA / Play / `assetlinks.json` **apex** üzerinde kalır; `www` yalnızca ziyaretçi yönlendirmesi içindir.

---

## 1) Render (web servisi)

1. [Render Dashboard](https://dashboard.render.com) → **benimogretmenim-web** → Settings → **Custom Domains**
2. **Add Custom Domain** → `www.benimogretmenim.com.tr`
3. Render’ın gösterdiği **CNAME** hedefini not alın — **web servisi** (`benimogretmenim-web`), API değil.

> Yanlış DNS teşhisi: `apps/web/DNS_FIX.md`
4. Durum **Verified** olana kadar bekleyin

> Apex (`benimogretmenim.com.tr`) zaten ekliyse sadece `www` eklemeniz yeterli.

---

## 2) Turhost DNS

Turhost → Alan adları → **DNS Yönetimi**:

| Tür | Host | Değer |
|-----|------|--------|
| CNAME | `www` | Render **web** CNAME (ör. `benimogretmenim-web.onrender.com`) |

Apex (`@`) kaydını değiştirmeyin; mevcut A/CNAME apex ayarı aynı kalsın.

Yayılım: 5–60 dk.

---

## 3) Ortam değişkenleri (Render)

**API** — `CORS_ORIGINS` içinde `www` olmalı:

```
https://benimogretmenim.com.tr,https://www.benimogretmenim.com.tr
```

**Web** — canonical apex kalsın:

```
NEXT_PUBLIC_SITE_URL=https://benimogretmenim.com.tr
```

---

## 4) Doğrulama

```powershell
nslookup www.benimogretmenim.com.tr 8.8.8.8
curl -I https://www.benimogretmenim.com.tr/
```

Beklenen:

- `HTTP/2 308` (veya 301)
- `location: https://benimogretmenim.com.tr/`

---

## 5) Search Console (isteğe bağlı)

- Birincil mülk: `https://benimogretmenim.com.tr`
- `www` mülkü ekleyebilirsiniz; yönlendirme sayesinde tek canonical apex yeterli
- Sitemap: `https://benimogretmenim.com.tr/sitemap.xml`

---

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| `www` açılmıyor | DNS CNAME + Render custom domain Verified |
| `www` açılıyor ama yönlendirme yok | Web deploy güncel mi; `NEXT_PUBLIC_SITE_URL` apex mi |
| SSL hatası | Render domain doğrulamasını bekleyin |
