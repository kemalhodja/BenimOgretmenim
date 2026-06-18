# BenimÖğretmenim — Google Play mağaza metinleri (politika uyumlu)

Play Console formları ve beyanlar: **`PLAY_CONSOLE_COMPLIANCE.md`**

Paket adı: `benimogretmenim.com.tr`  
AAB: `apps/twa-android/app/build/outputs/bundle/release/app-release.aab` (veya CI artifact)

---

## Uygulama adı

BenimÖğretmenim

---

## Kısa açıklama (max 80 karakter)

Öğrenci, veli ve öğretmeni özel ders sürecinde buluşturan eğitim platformu.

*(Alternatif, 80 karakter sınırına göre kısaltın:)*  
Özel ders için öğretmen bulun, dersinizi takip edin.

---

## Uzun açıklama (mağaza — Play politikasına uygun)

BenimÖğretmenim; öğrencilerin ve velilerin ihtiyacına uygun öğretmen bulmasını, öğretmenlerin kendini profesyonel bir profil sayfasıyla tanıtmasını ve ders sürecinin düzenli ilerlemesini sağlayan bir **eğitim platformudur**.

**Öğrenciler ve veliler**

- Branş ve şehre göre öğretmen arayabilir
- Öğretmen profillerini inceleyebilir
- Demo ders veya teklif talebi oluşturabilir
- Ders, ödev ve çalışma planını takip edebilir

**Öğretmenler**

- Profil sayfasını paylaşılabilir bir vitrin olarak kullanabilir
- Talepleri ve teklifleri tek panelde yönetebilir
- Ders, ödev havuzu ve öğrenci iletişimini organize edebilir

**Öne çıkan özellikler**

- Öğretmen arama ve filtreleme
- Demo ders ve teklif akışı
- Canlı ders ve ders sonrası notlar
- Ödev / soru gönderme ve çalışma planı
- Veli için ilerleme takibi
- Ders ve abonelik için güvenli ödeme altyapısı (kart bilgisi uygulamada saklanmaz)

BenimÖğretmenim, öğrenci–öğretmen–veli arasındaki **özel ders ve eğitim sürecini** daha net ve takip edilebilir kılmak için tasarlanmıştır. Uygulama bir finans, sağlık veya bankacılık hizmeti değildir.

**Yazmayın (Play reddi riski):** dijital cüzdan, para transferi, yatırım, kredi, tıbbi teşhis, klinik hizmet.

---

## Kategori ve etiketler

| Alan | Değer |
|------|--------|
| Kategori | **Eğitim** |
| Etiketler | özel ders, online ders, öğretmen bul, YKS, LGS, ödev, veli takip |

---

## Ekran görüntüsü planı (min 4, önerilen 6–8)

Politika uyumlu sıra — **ödeme veya cüzdan ekranı kullanmayın**:

1. Ana sayfa — “Öğretmen bul, ders al…”
2. Öğretmen arama — filtreler ve kartlar
3. Öğretmen profili — demo / teklif butonu
4. Öğrenci paneli — özet ve çalışma planı
5. Öğretmen paneli — teklifler ve profil kalitesi
6. Ödev / soru gönderme akışı
7. Güven merkezi veya ders takibi
8. Veli paneli özeti *(isteğe bağlı)*

**Görüntülerde olmamalı:** gerçek telefon, e-posta, kart numarası, IBAN, kimlik, canlı ödeme tutarı. Seed/demo veri kullanın.

---

## Data Safety — özet cevaplar

Detaylı form rehberi: `PLAY_CONSOLE_COMPLIANCE.md` §6

| Soru | Cevap |
|------|--------|
| Veri toplar mı? | Evet |
| Şifreli aktarım | Evet (HTTPS) |
| Silme talebi | Evet (`/iletisim`) |
| Çocuklara özel mi? | Hayır (genel eğitim; veli gözetimi metinlerde) |

**Toplanan veriler:** hesap (e-posta, ad), isteğe bağlı telefon, öğretmen profili, ders/ödev içeriği, **satın alma geçmişi** (ders/abonelik), uygulama etkinliği, fotoğraf (ödev için).

**Amaçlar:** hesap, eşleştirme, ders süreci, satın alma kaydı, güvenlik, destek.

**Paylaşım:** ödeme sağlayıcı (PayTR), barındırma — reklam ağı değil.

---

## Gizlilik ve yasal linkler

| Alan | URL |
|------|-----|
| Gizlilik | `https://benimogretmenim.com.tr/gizlilik` |
| Kullanım koşulları | `https://benimogretmenim.com.tr/kullanim-kosullari` |
| İletişim | `https://benimogretmenim.com.tr/iletisim` |

Domain canlı değilse Play yayınına geçmeyin.

---

## İnceleme notu şablonu (İngilizce)

Play Console → **Uygulama erişimi** → Notlar:

```
Education marketplace (TWA). Test with provided student/teacher logins.
Browse teachers, create lesson requests, view study panel.
Lesson/subscription checkout uses PayTR on the website; no in-app financial product.
Not a health, banking, or digital wallet app.
```

Test hesap e-posta/şifrelerini buraya ekleyin.

---

## Yayın öncesi kontrol listesi

- [ ] `PLAY_CONSOLE_COMPLIANCE.md` formları dolduruldu
- [ ] Finansal özellikler: **sunmuyor**
- [ ] Sağlık: **sunmuyor**
- [ ] Signed AAB yüklendi
- [ ] Play App Signing SHA-256 → `assetlinks.json`
- [ ] `assetlinks.json` canlıda doğru
- [ ] Mağaza metni bu dosyadaki uyumlu sürüm
- [ ] Ekran görüntüleri ödeme/cüzdan içermiyor
- [ ] Data Safety gizlilik ile uyumlu
- [ ] Test hesapları inceleme notunda
- [ ] Production smoke geçti
