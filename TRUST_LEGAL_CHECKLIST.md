# Trust and Legal Checklist

Bu kontrol listesi hukuk danismani yerine gecmez; urun, destek ve teknik ekip icin yayina hazirlik standardidir.

## KVKK / Gizlilik

- Gizlilik metni odeme, cüzdan, canlı ders, ödev/soru fotoğrafı ve veli-öğrenci ilişkisini kapsar.
- Kişisel veri kategorileri açık yazılır: hesap, iletişim, ödeme, eğitim içeriği, destek, teknik log.
- Saklama süreleri belirlenir.
- Silme/düzeltme/erişim talepleri için destek süreci tanımlanır.
- Çocuk/öğrenci verisi için veli ilişkisi ve sorumluluk sınırları açıklanır.

## Kullanım Koşulları

- Öğrencinin platforma ödeme yaptığı model açık yazılır.
- Öğretmenin platforma komisyon ödemediği, hak ediş aldığı netleşir.
- Canlı ders, kurs, grup ders, soru çözümü ve kampanya ilanı kuralları ayrılır.
- Kötüye kullanım, sahte hesap, ödeme itirazı ve hesap kapatma maddeleri bulunur.

## İade Politikası

- Canlı sayfa: `/iade` (sitemap + `/fiyatlar`, `/guven` linkleri).
- Ders başlamadan iptal.
- Ders başladıktan sonra iade.
- Öğretmen gelmedi / öğrenci gelmedi.
- Teknik aksaklık.
- Kurs/grup ders iptali.
- Cüzdan bakiyesi iadesi.
- PayTR veya banka kaynaklı gecikme.

Her madde için kullanıcıya gösterilecek karar dili hazırlanmalıdır.

## Öğretmen Doğrulama

- Kimlik/iletişim doğrulama standardı.
- Branş ve deneyim beyanı.
- Banka hesap sahibi eşleşmesi.
- Güven rozetlerinin hangi şartla gösterildiği.
- Şikayet/ihlal durumunda rozet veya görünürlük kaldırma süreci.

## Destek ve Şikayet

- İtiraz self-service: `/itiraz` (giriş gerekir).
- Destek SLA dashboard: `/admin/destek-sla`.
- Odeme/iade.
- Ders gerçekleşmedi.
- Öğretmen/öğrenci davranış şikayeti.
- Hesap erişimi.
- Veli bağlantısı.
- Veri silme/düzeltme talebi.

Her kategori için SLA belirlenmelidir: ilk yanıt, çözüm hedefi, eskalasyon.

## Mağaza Yayını

APK/Play Store en sona bırakıldı. Yayın öncesi:

- `apps/twa-android/PLAY_CONSOLE_COMPLIANCE.md` — Play formları (finansal özellikler: sunmuyor; sağlık: yok; kategori: Eğitim).
- `apps/twa-android/PLAY_STORE_LISTING.md` — mağaza metinleri (cüzdan/finans vurgusu yok).
- `apps/twa-android/play-review-notes-en.txt` — inceleme notu şablonu.
- Ekran görüntüleri (ödeme/cüzdan ekranı yok).
- Data Safety gizlilik ile uyumlu.
- `assetlinks.json` SHA-256 fingerprint.
- Signed AAB.
- Test cihazında TWA doğrulaması.

## Yayın Öncesi Kapanış

- Hukuk metinleri onaylandı.
- İade politikası `/iade` ve ödeme ekranlarından erişilebilir.
- KVKK silme `/ayarlar/hesap`; askıya alma `/hesap-askida`.
- Deploy runbook: `GAP_DEPLOY_RUNBOOK.md`.
- Destek kategorileri admin/destek panelinde karşılanıyor.
- Finans runbook ve security runbook ekip tarafından okundu.
- Production smoke, ödeme callback smoke ve login smoke geçti.
