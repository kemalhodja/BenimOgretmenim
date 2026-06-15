# BenimOgretmenim Google Play Listeleme Hazirligi

Bu dosya Google Play Console'a girilecek metinleri ve yayin oncesi kontrol listesini toplar. Uygulama paketi `benimogretmenim.com.tr`, AAB cikti yolu `apps/twa-android/dist/app-release.aab` veya GitHub Actions artifact'i icindeki `app-release.aab` olmalidir.

## Uygulama Adi

BenimOgretmenim

## Kisa Aciklama

Ogrenci, veli ve ogretmeni guvenli ders, teklif, odeme ve takip surecinde bulusturan egitim platformu.

## Uzun Aciklama

BenimOgretmenim; ogrencilerin ve velilerin ihtiyaca uygun ogretmen bulmasini, ogretmenlerin profesyonel profil sayfasi ile kendini tanitmasini ve ders surecinin daha guvenli ilerlemesini saglayan bir egitim platformudur.

Ogrenciler ve veliler ogretmen profillerini inceleyebilir, brans ve sehir bilgilerine gore arama yapabilir, demo ders talebi olusturabilir ve teklif surecini platform icinde takip edebilir. Ogretmen profillerinde uzmanlik alanlari, tanitim metni, ders yaklasimi, yorumlar, guven sinyalleri ve istege bagli telefon/WhatsApp iletisim bilgileri yer alabilir.

Ogretmenler abonelikle profilini kisisel web sayfasi gibi kullanabilir. Profil linkini sosyal medyada, WhatsApp mesajlarinda veya veli/ogrenci gorusmelerinde paylasabilir. Platform, ogretmenin kendini daha profesyonel anlatmasina ve basvurulari tek yerde toplamasina yardim eder.

BenimOgretmenim ders surecini sadece ilan ve mesajlasma olarak gormez. Demo talebi, teklif, cuzdan/odeme kaydi, canli ders, odev, ders sonu notlari ve veli takibi gibi adimlari daha gorunur hale getirir. Amac, ogrenci icin dogru ogretmeni bulmayi kolaylastirmak ve ders sonrasi gelisimi takip edilebilir kilmaktir.

One cikan ozellikler:

- Brans, sehir ve guven sinyallerine gore ogretmen arama
- Demo ders ve teklif talebi
- Ogretmenler icin paylasilabilir profesyonel profil sayfasi
- Abone ogretmenlerde istege bagli telefon ve WhatsApp iletisim alani
- Ogrenci ve veli icin ders, odev ve ilerleme takibi
- Guvenli odeme ve kayitli ders sureci
- Mobilde hizli erisim icin web uygulamasi deneyimi

BenimOgretmenim, ogrenci, veli ve ogretmen arasindaki egitim surecini daha net, daha takip edilebilir ve daha guvenli hale getirmek icin tasarlanmistir.

## Kategori ve Etiketler

Kategori: Education / Egitim

Onerilen etiketler:

- ozel ders
- online ders
- ogretmen bul
- LGS
- YKS
- odev
- veli takip
- egitim

## Ekran Goruntusu Plani

Google Play icin en az 4, tercihen 6-8 ekran goruntusu hazirlanmali.

Onerilen ekranlar:

1. Ana sayfa: "Ogretmen bul, ders al, gelisimini takip et" hero alani.
2. Ogretmen arama: filtreler, secim sihirbazi ve ogretmen kartlari.
3. Ogretmen profili: kisisel web sayfasi, demo/teklif CTA, guven sinyalleri.
4. Ogrenci paneli: ozet, bugun ne yapmaliyim, calisma plani.
5. Ogretmen paneli: profil kalitesi, teklifler, kazanc/gorunurluk alanlari.
6. Veli paneli: ogrenci ilerlemesi ve takip kartlari.
7. Soru/odev gonderme: fotograf veya aciklama ile yardim akisi.
8. Guven/odeme: guvenli odeme ve ders takip sureci.

Ekran goruntulerinde gercek kisi telefon numarasi, e-posta, odeme karti, kimlik veya hassas veri gorunmemeli. Seed/demo verisi kullanilmali.

## Data Safety Taslagi

Google Play Data Safety formu icin taslak cevaplar:

- Uygulama veri toplar: Evet.
- Veri sifrelenerek aktarilir: Evet, HTTPS kullanilir.
- Kullanici veri silme talep edebilir: Evet, iletisim kanali uzerinden talep alinabilir.
- Uygulama cocuklara yonelik mi: Hayir, genel egitim platformu; cocuk hesaplari veli/ogrenci sorumlulugunda degerlendirilmelidir.
- Ucuncu taraflarla veri paylasimi: Odeme saglayici, altyapi ve yasal zorunluluklar gibi hizmet gereklilikleriyle sinirli.

Toplanan veri kategorileri:

- Hesap bilgileri: e-posta, gorunen ad, rol, oturum bilgisi.
- Iletisim bilgileri: telefon numarasi yalnizca kullanici eklerse ve gerekli akislarda.
- Kullanici icerigi: ogretmen profili, biyografi, ders talebi, odev/soru aciklamasi, mesaj/teklif icerikleri.
- Finansal islem bilgileri: odeme durumu, cuzdan hareketi, islem kaydi. Kart bilgileri uygulama sunucusunda saklanmaz.
- Uygulama etkinligi: ders, teklif, panel kullanimi, audit ve guvenlik kayitlari.
- Fotograf/dosya: ogrencinin soru/odev gonderimi veya ogretmenin profil/dokuman kaniti icin kullanilabilir.

Kullanim amaclari:

- Hesap yonetimi
- Ogretmen-ogrenci eslestirme
- Ders, teklif ve odev surecini isletme
- Odeme ve cuzdan kayitlarini yurutme
- Guvenlik, dolandiricilik onleme ve audit
- Bildirim, destek ve operasyon

## Gizlilik ve Yasal Linkler

Google Play Console'a girilecek linkler:

- Gizlilik politikasi: `https://benimogretmenim.com.tr/gizlilik`
- Kullanim kosullari: `https://benimogretmenim.com.tr/kullanim-kosullari`
- Iletisim: `https://benimogretmenim.com.tr/iletisim`

Ozel alan adi canli degilse gecici Render adresleri yerine Play yayinindan once kalici alan adi tercih edilmeli.

## Yayin Oncesi Kontrol

- AAB dosyasi signed release olarak uretildi.
- Package name `benimogretmenim.com.tr`.
- Play App Signing SHA-256 degeri `assetlinks.json` icine eklendi.
- `https://benimogretmenim.com.tr/.well-known/assetlinks.json` canli ve dogru.
- Uygulama ikonu ve feature graphic hazir.
- En az 4 temiz ekran goruntusu hazir.
- Gizlilik politikasi ve kullanim kosullari canli URL'de aciliyor.
- Data Safety cevaplari gizlilik metniyle tutarli.
- Demo hesap veya inceleme notlari gerekiyorsa Play Console'a eklendi.
- Test kullanicilarinda gercek kisi verisi yok.
- Production smoke ve temel web build basarili.
