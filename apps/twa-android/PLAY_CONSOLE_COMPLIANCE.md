# Google Play Console — Politika Uyumu (BenimÖğretmenim TWA)

Bu rehber, **bireysel (Personal) geliştirici hesabı** ile yayın için Play Console formlarında ne işaretleyeceğinizi adım adım verir.

**Önemli ayrım:** Uygulama bir **eğitim pazaryeri**dir (özel ders, öğretmen bulma, ders takibi). Bankacılık, kredi, borsa, genel amaçlı dijital cüzdan veya sağlık/tıbbi hizmet **değildir**. Ders ve abonelik ödemeleri lisanslı ödeme sağlayıcı (PayTR) üzerinden yapılır; kart bilgisi uygulama sunucusunda saklanmaz.

Play Console yolu: **Politika ve programlar → Uygulama içeriği**

---

## 1) Geliştirici hesap türü

**Seçilen yol: Bireysel (Personal) hesap** — kurumsal hesap açılmayacak.

| Durum | Ne yapın |
|-------|----------|
| **Bireysel hesap (sizin seçiminiz)** | Aşağıdaki beyanları doğru doldurun; mağaza metninde cüzdan/finans vurgusu yapmayın |
| “Kurumsal hesap gerekli” reddi | Önce **Finansal özellikler** ve **Sağlık** formlarını bu rehbere göre düzeltip yeniden gönderin |
| Red aynı kalırsa | Play destek talebi açın (eğitim pazaryeri, finansal ürün değil). Kurumsal hesap son çare — `PLAY_ORGANIZATION_ACCOUNT.md` |

Kurumsal hesap rehberi yalnızca Google ısrar ederse bakılır; şu an **gerekli değil**.

---

## 2) Finansal özellikler (Financial features) — KRİTİK

**Yol:** Uygulama içeriği → Finansal özellikler

**Seçim:**

> **Uygulamam finansal özellik sunmuyor**  
> *(İngilizce arayüz: “My app doesn’t provide any financial features”)*

**İşaretlemeyin:**

- Mobil ödeme ve dijital cüzdan
- Bankacılık / kredi / para transferi
- Kripto, borsa, sigorta, finansal danışmanlık

**Gerekçe (inceleme notuna yapıştırılabilir):**

> BenimÖğretmenim is an education marketplace (private tutoring). Users purchase lessons and subscriptions through a licensed third-party payment processor (PayTR) on the website. The Android app is a Trusted Web Activity shell with no in-app billing SDK, no standalone wallet product, and no financial services. Platform balance records are escrow-style lesson booking credits, not a consumer digital wallet.

---

## 3) Sağlık uygulamaları (Health apps)

**Seçim:** Uygulama **sağlık veya tıbbi özellik sunmuyor**.

İşaretlemeyin: tıbbi cihaz, teşhis, tedavi, klinik araştırma, sağlık verisi senkronizasyonu.

*(Eğitim / sınav hazırlığı / ödev takibi sağlık uygulaması sayılmaz.)*

---

## 4) Mağaza kategorisi

| Alan | Değer |
|------|--------|
| Uygulama türü | Uygulama |
| Kategori | **Eğitim** |
| Etiketler | özel ders, öğretmen bul, online ders, YKS, LGS, ödev |

**Kategori olarak Sağlık, Finans, İş seçmeyin.**

---

## 5) Hedef kitle ve içerik derecelendirmesi

### Hedef kitle (Target audience)

- **Çocuklara yönelik tasarlanmadı** (“Not designed for children” / 13 yaş altı birincil kitle değil).
- Eğitim platformu; reşit olmayan öğrenciler veli gözetiminde hesap açar (metinlerde belirtilir).

### İçerik derecelendirme anketi (özet)

| Soru alanı | Tipik cevap |
|------------|-------------|
| Şiddet | Yok |
| Cinsellik | Yok |
| Küfür | Kullanıcı içeriğinde nadiren (moderasyon var) |
| Kontrollü madde | Yok |
| Kullanıcı etkileşimi | Evet (mesaj, profil, talep) |
| Konum paylaşımı | Hayır (toplanmıyorsa) |
| Kişisel bilgi paylaşımı | Evet (hesap, iletişim — kullanıcı isteğiyle) |

Anketi doldururken uygulamanın **gerçek** davranışına göre cevaplayın; tahmin etmeyin.

---

## 6) Veri güvenliği (Data safety)

**Yol:** Uygulama içeriği → Veri güvenliği

| Soru | Cevap |
|------|--------|
| Veri topluyor mu? | Evet |
| Aktarımda şifreleme | Evet (HTTPS) |
| Veri silme talebi | Evet (`/iletisim` üzerinden) |
| Hesap oluşturma zorunlu mu? | Çoğu özellik için evet |

### Toplanan veri türleri (örnek)

| Tür | Toplanıyor | Paylaşılıyor | Amaç |
|-----|------------|--------------|------|
| Ad, e-posta | Evet | Hayır* | Hesap |
| Telefon | İsteğe bağlı | Hayır* | İletişim (kullanıcı eklerse) |
| Fotoğraflar / dosyalar | Evet | Hayır* | Ödev/soru, profil |
| Uygulama etkinliği | Evet | Hayır* | Ders, talep, güvenlik |
| **Satın alma geçmişi** | Evet | Hayır* | Ders/abonelik kaydı |
| Tanımlayıcılar | Evet (oturum) | Hayır* | Oturum |

\* Ödeme sağlayıcı ve barındırma gibi **hizmet sağlayıcıları** ile sınırlı paylaşım — “üçüncü taraf reklam” değil.

**Not:** Data Safety’de “Satın alma geçmişi” işaretlemek, Finansal özellikler formunda “dijital cüzdan” seçmekten **farklıdır** ve eğitim pazaryerleri için normaldir.

**İşaretlemeyin (uygulama sunmuyorsa):** banka hesap numarası, kredi skoru, hassas sağlık verisi.

---

## 7) Uygulama erişimi (App access)

İnceleme için test hesabı verin:

```
Öğrenci: [seed öğrenci e-posta] / [şifre]
Öğretmen: [seed öğretmen e-posta] / [şifre]
Veli: [seed veli e-posta] / [şifre] (varsa)
```

**İnceleme notu (İngilizce — Play Console “Notes for reviewer”):**

```
BenimÖğretmenim is an education marketplace (Trusted Web Activity).

Login: use the student or teacher test account above.
After login you can browse teacher profiles, lesson requests, and study tracking.
Payments for lessons/subscriptions are processed on the website via PayTR (licensed PSP); card data is not stored on our servers.

This is NOT a financial services, health, or VPN app.
Category: Education only.
```

---

## 8) Mağaza metinleri

Kopyala-yapıştır metinler: `PLAY_STORE_LISTING.md`

**Kurallar:**

- “Dijital cüzdan”, “finansal platform”, “para transferi” yazmayın.
- “Ders ve abonelik satın alma”, “güvenli ödeme altyapısı” kullanın.
- Ekran görüntülerinde kart numarası, IBAN, cüzdan bakiyesi göstermeyin.

---

## 9) Ekran görüntüsü sırası (politika uyumlu)

1. Ana sayfa — öğretmen bulma
2. Öğretmen arama / filtreler
3. Öğretmen profili — demo ders talebi
4. Öğrenci paneli — çalışma planı
5. Öğretmen paneli — teklifler / profil
6. Ödev / soru gönderme
7. Güven merkezi veya ders takibi
8. *(İsteğe bağlı)* Veli takip özeti

**8. ekran olarak ödeme/cüzdan ekranı kullanmayın.**

---

## 10) Teknik zorunluluklar

- [ ] Signed AAB (`app-release.aab`)
- [ ] `targetSdk` güncel (repo: 35+)
- [ ] `https://benimogretmenim.com.tr/.well-known/assetlinks.json` — Play App Signing SHA-256
- [ ] Gizlilik: `https://benimogretmenim.com.tr/gizlilik`
- [ ] Kullanım koşulları: `https://benimogretmenim.com.tr/kullanim-kosullari`
- [ ] İletişim: `https://benimogretmenim.com.tr/iletisim`

---

## 11) Red alırsanız

1. **Politika durumu** e-postasındaki tam metni okuyun.
2. **Finansal özellikler** ve **Sağlık** formlarını bu rehbere göre düzeltin.
3. Mağaza açıklamasını `PLAY_STORE_LISTING.md` ile değiştirin.
4. Yeniden gönderin.
5. Aynı red devam ederse: Play Console → **Yardım → Destek talebi** — Organization hesabınız varsa doğrulama ekran görüntüsü ekleyin; yoksa eğitim pazaryeri olduğunuzu ve finansal ürün sunmadığınızı belirtin.

---

## 12) Yayın öncesi son kontrol

Adım adım liste: **`RELEASE_CHECKLIST.md`**

- [ ] Finansal özellikler: **sunmuyor**
- [ ] Sağlık: **sunmuyor**
- [ ] Kategori: **Eğitim**
- [ ] Mağaza metni cüzdan/finans vurgusu içermiyor
- [ ] Data Safety gizlilik metniyle uyumlu
- [ ] Test hesapları inceleme notunda
- [ ] assetlinks.json canlı ve doğru
