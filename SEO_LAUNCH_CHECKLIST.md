# SEO ve `.com.tr` Lansman Kontrol Listesi

BenimÖğretmenim’in arama görünürlüğü ve güven sayfalarının indekslenmesi için adım adım kontrol.

## 1) DNS (Turhost — kullanıcı aksiyonu)

- [ ] `benimogretmenim.com.tr` → Render web CNAME/A kaydı
- [ ] `www.benimogretmenim.com.tr` → Render (isteğe bağlı)
- [ ] `api.benimogretmenim.com.tr` → Render API
- [ ] `nslookup benimogretmenim.com.tr 8.8.8.8` doğru IP/CNAME döndürüyor
- [ ] `https://api.benimogretmenim.com.tr/health` → `db: true`

Ayrıntılar: `DEPLOYMENT.md` bölüm 7 (Turhost).

## 2) Render ortam değişkenleri

- [ ] `NEXT_PUBLIC_SITE_URL=https://benimogretmenim.com.tr`
- [ ] `NEXT_PUBLIC_API_BASE_URL=https://api.benimogretmenim.com.tr`
- [ ] `CORS_ORIGINS` `.com.tr` köklerini içeriyor

## 3) Google Search Console

1. [Search Console](https://search.google.com/search-console) → **Mülk ekle** → `https://benimogretmenim.com.tr`
2. DNS TXT veya HTML dosyası ile doğrula
3. **Site haritaları** → `https://benimogretmenim.com.tr/sitemap.xml` gönder
4. **URL denetimi** ile ana sayfa + `/guven`, `/iade`, `/itiraz` indeks isteği (isteğe bağlı)

Sitemap’te yer alan güven URL’leri: `/guven`, `/iade`, `/itiraz`, `/gizlilik`, `/kullanim-kosullari`.

## 4) Yapılandırılmış veri

- [ ] Ana layout’ta Organization + WebSite JSON-LD (`SiteWideJsonLd`)
- [ ] `/yardim` FAQ JSON-LD
- [ ] `/iletisim` iletişim JSON-LD
- [ ] Öğretmen ve kurs detay sayfalarında ilgili JSON-LD

## 5) robots.txt

- [ ] `https://benimogretmenim.com.tr/robots.txt` panel/ödeme yollarını engelliyor, sitemap satırı var

## 6) Yönlendirme

- [ ] `benimogretmenim.onrender.com` → `.com.tr` 308 yönlendirmesi çalışıyor

## 7) TWA / Play (SEO ile ilişkili)

- [ ] `https://benimogretmenim.com.tr/.well-known/assetlinks.json` canlı (Play imza SHA-256 sonrası)
- [ ] `/uygulama` sayfası mağaza linki veya “yakında” metni güncel

Ayrıntılar: `apps/twa-android/RELEASE_CHECKLIST.md`

## 8) Lansman sonrası (1. hafta)

- [ ] Search Console → Dizin oluşturma → hata yok
- [ ] “site:benimogretmenim.com.tr guven” aramasında güven sayfaları görünüyor (birkaç gün sürebilir)
- [ ] Core Web Vitals / Mobil kullanılabilirlik uyarısı yok

Son güncelleme: 2026-06-17
