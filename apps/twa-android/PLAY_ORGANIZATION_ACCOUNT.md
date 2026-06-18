# Google Play — Kurumsal (Organization) Geliştirici Hesabı (Türkiye)

> **Not:** BenimÖğretmenim **bireysel (Personal) hesap** ile yayınlanacak. Bu dosya yalnızca Google’ın kurumsal hesap şartı koşması halinde son çare rehberidir.

BenimÖğretmenim için **Yol B (isteğe bağlı / son çare)**: Play Console’un istediği **Organization** hesabı ile yayın.

Bu rehber hukuk/muhasebe danışmanlığı yerine geçmez; pratik kontrol listesidir.

---

## Ön koşullar

| Gereksinim | Açıklama |
|------------|----------|
| Tüzel kişilik | **Limited şirket (Ltd. Şti.)** veya kayıtlı **şahıs şirketi** |
| Vergi levhası | Aktif vergi mükellefiyeti |
| Şirket e-postası | `@sirketadiniz.com` (gmail önerilmez) |
| Şirket telefonu | Play’de görünecek, doğrulanabilir numara |
| D-U-N-S | Dun & Bradstreet şirket numarası (zorunlu) |
| Ödeme profili | Google Payments — **şirket adına** |

---

## Adım 1 — Şirket (yoksa)

**Limited şirket** (önerilen — yatırımcı/ortaklık için uygun):

1. Ticaret sicil / MERSİS üzerinden kuruluş
2. Vergi dairesi kaydı
3. Şirket banka hesabı (PayTR ve operasyon için)

**Şahıs şirketi** (daha hızlı, tek ortak):

1. Vergi dairesinde şahıs işletmesi açılışı
2. Ticaret sicil kaydı (gerekiyorsa)

Play için önemli olan: **resmi unvan** ve **adres** tutarlı olsun (MERSİS, vergi levhası, D-U-N-S aynı).

---

## Adım 2 — D-U-N-S numarası

Organization hesap için **zorunlu**.

1. [dnb.com.tr](https://www.dnb.com.tr) → D-U-N-S talebi
2. Şirket unvanı, adres, vergi no ile başvuru
3. Onay **birkaç iş günü – 2 hafta** sürebilir
4. Numarayı not edin (9 haneli)

Google, ödeme profili ve D-U-N-S kaydındaki **unvan/adres eşleşmesini** kontrol eder.

---

## Adım 3 — Play Console Organization hesabı

### Yeni hesap (önerilen — bireysel hesapta red varsa)

1. [play.google.com/console](https://play.google.com/console) → **Yeni geliştirici hesabı**
2. Hesap türü: **Organization / Kuruluş**
3. D-U-N-S girin → Google doğrular
4. **Google Payments profili** oluşturun veya bağlayın:
   - Yasal ad = şirket unvanı (Ltd. Şti. dahil)
   - Adres = kayıtlı şirket adresi
5. Geliştirici iletişim:
   - Kurumsal e-posta
   - Kurumsal telefon (SMS doğrulama)
6. Kayıt ücreti: tek seferlik Play geliştirici ücreti (güncel tutar Play’de gösterilir)
7. Kimlik doğrulama: yetkili temsilci (siz veya ortak) için kimlik + şirket belgesi

### Mevcut bireysel hesabı dönüştürme

Play Console → **Ayarlar** → hesap türü dönüşümü (mümkünse).  
Dönüşüm her zaman açık olmayabilir; red devam ederse **yeni Organization hesabı** + uygulamayı oraya taşımak daha hızlı olabilir.

---

## Adım 4 — Uygulamayı kurumsal hesaba taşıma

| Senaryo | Ne yapın |
|---------|----------|
| İlk yayın | Organization hesapta yeni uygulama oluşturun, AAB yükleyin |
| Bireysel hesapta taslak var | Organization’da **yeni** uygulama; paket adı `benimogretmenim.com.tr` aynı kalabilir (eski taslak silinmeli veya farklı paket — **aynı paket iki hesapta olamaz**) |
| İç transfer | Google destek ile hesap transferi nadiren mümkün; genelde yeniden yükleme |

**Paket adı:** `benimogretmenim.com.tr` (değiştirmeyin — TWA / assetlinks buna bağlı)

---

## Adım 5 — Organization ile beyanlar

Kurumsal hesapta bile yanlış beyan red getirir. Şunları kullanın:

| Form | Seçim |
|------|--------|
| Finansal özellikler | **Sunmuyor** (eğitim pazaryeri; ayrıntı: `PLAY_CONSOLE_COMPLIANCE.md`) |
| Sağlık | **Yok** |
| Kategori | **Eğitim** |
| Mağaza metni | `PLAY_STORE_LISTING.md` |
| Data Safety | `PLAY_CONSOLE_COMPLIANCE.md` §6 |

Organization hesap, **finansal ürün** beyan ettiğinizde zorunlu; eğitim pazaryeri olarak doğru beyanla bireysel reddi de aşabilirsiniz — ama Google ısrar ederse kurumsal hesap şarttır.

---

## Adım 6 — Play Console’da şirket bilgileri

**Mağaza varlığı → Geliştirici iletişim bilgileri**

- Geliştirici adı: şirket unvanı (ör. `Benim Öğretmenim … Ltd. Şti.`)
- Web sitesi: `https://benimogretmenim.com.tr`
- E-posta: `destek@benimogretmenim.com.tr` veya kurumsal adres
- Gizlilik politikasında **veri sorumlusu** şirket unvanı geçmeli (gerekirse `/gizlilik` güncellenir)

---

## Adım 7 — PayTR ve fatura uyumu

- PayTR mağaza başvurusu **şirket unvanı** ile
- Vergi levhası, imza sirküleri, banka hesabı şirket adına
- Play’deki yasal satıcı = PayTR’deki merchant = şirket unvanı (tutarlılık)

---

## Adım 8 — Yayın kontrol listesi

- [ ] D-U-N-S onaylandı
- [ ] Organization Play hesabı doğrulandı
- [ ] Signed AAB (`android-aab` workflow)
- [ ] `assetlinks.json` — Play App Signing SHA-256
- [ ] `PLAY_STORE_LISTING.md` metinleri girildi
- [ ] `play-review-notes-en.txt` + production test hesapları
- [ ] `benimogretmenim.com.tr` DNS canlı
- [ ] Gizlilik / kullanım koşulları şirket unvanıyla uyumlu

---

## Süre tahmini

| Adım | Süre |
|------|------|
| Ltd. şirket kuruluşu | 1–3 hafta |
| D-U-N-S | 3–14 gün |
| Play Organization doğrulama | 1–7 gün |
| İlk inceleme | 1–7 gün |

---

## Destek talebi (red devam ederse)

Play Console → **Yardım** → **Destek talebi oluştur**

Ekleyin:

- Organization hesap doğrulama ekran görüntüsü
- D-U-N-S onay e-postası
- “Education marketplace, not financial services” — `play-review-notes-en.txt` metni
- Kategori: Education

---

## İlgili dosyalar

- `PLAY_CONSOLE_COMPLIANCE.md` — form cevapları
- `PLAY_STORE_LISTING.md` — mağaza metinleri
- `play-review-notes-en.txt` — inceleme notu
- `BUILD.txt` — AAB üretimi
