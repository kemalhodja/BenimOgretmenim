# Security Runbook

Bu dokuman production guvenligi, secret rotasyonu, oturum yonetimi ve olay mudahalesi icin uygulanacak minimum standardi tanimlar.

## Production Secret Standardi

Production ortaminda su degiskenler bos olamaz:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_API_SECRET`
- `CORS_ORIGINS`
- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`
- `PAYTR_BASE_URL`
- `PAYTR_OK_URL`
- `PAYTR_FAIL_URL`
- `PAYTR_CALLBACK_URL`

API boot sirasinda eksik production config varsa servis baslamamalidir.

## Secret Rotasyonu

### JWT_SECRET

1. Bakim penceresi belirlenir.
2. Tum aktif kullanicilarin yeniden giris yapacagi kabul edilir.
3. Yeni `JWT_SECRET` Render/GitHub secret olarak tanimlanir.
4. API deploy edilir.
5. Login, register, `/v1/auth/me`, admin ve odeme callback smoke testleri yapilir.

### ADMIN_API_SECRET

1. Yeni secret uretilir.
2. Web/API env ayni anda guncellenir.
3. Admin proxy ve admin API smoke testleri yapilir.
4. Eski secret paylasilmis dokumanlardan kaldirilir.

### PayTR Secretlari

1. PayTR panelinde yeni key/salt planlanir.
2. Callback hash dogrulamasi icin API env guncellenir.
3. Kucuk tutarli test odemesi ve callback dogrulamasi yapilir.
4. Eski key/salt kullanimi kapatilir.

## Oturum ve CSRF

- Yeni login/register akisi HttpOnly `bo_session` cookie kullanir.
- Frontend JWT'yi yeni oturumlarda `localStorage`'a yazmaz.
- UI icin sadece rol/user hint cookie/cache kullanilir; yetki kaynagi degildir.
- Unsafe methodlar cookie auth ile gelirse `X-CSRF-Token` zorunludur.
- Yeni oturumlarda CSRF degeri per-session `bo_csrf` cookie'den okunur.
- Eski sabit CSRF degeri sadece geriye uyumluluk icindir ve sonraki fazda kaldirilmalidir.

## CSP

Mevcut CSP report-only modunda takip edilir. Enforce'a gecmeden once:

1. Report-only ihlalleri 7 gun izlenir.
2. Gerekli third-party kaynaklar listeye eklenir.
3. Inline script/style bagimliligi azaltılır.
4. Staging'de enforce denenir.
5. Production enforce acilir.

## Supheli Aktivite

Alarm uretilecek sinyaller:

- Kisa surede cok sayida login hatasi.
- Ayni kullanicida cok sayida odeme hatasi.
- Amount mismatch veya unknown merchant oid artisi.
- Admin finans aksiyonlarinda beklenmeyen yogunluk.
- Audit write failure veya reconciliation write failure.

## Guvenlik Olayi Mudahalesi

1. Olay P0/P1/P2 olarak siniflandirilir.
2. Etkilenen kullanici, payment, wallet, admin audit ve requestId listesi cikarilir.
3. Gerekirse admin finans aksiyonlari durdurulur.
4. Secret sizintisi ihtimali varsa ilgili secret rotate edilir.
5. Kullanicilara bildirilecek metin hukuk/onay akisi ile hazirlanir.
6. Postmortem: sebep, etki, kalici onlem, test eksigi.

## Dosya Yukleme Guvenligi

Dosya yukleme veya kamera ile gorsel kabul edilen akislarda:

- Boyut limiti uygulanir.
- MIME type ve uzanti kontrol edilir.
- Public URL'ler tahmin edilemez olmalidir.
- Ozel/ogrenci verisi iceren dosyalar yetkisiz erisime kapali olmalidir.
- Virus/malware taramasi production fazinda planlanir.

## Admin Operasyon ve Yetki

### Admin kapsami (`admin_scope`)

- `full`: tum moduller (rol degisikligi, finans, destek).
- `finance`: odeme, havale, cuzdan, mutabakat, para cekme.
- `support`: kullanicilar, ogretmenler, destek, kurs basvurulari (finans disi).

JWT ve oturum hint cookie (`bo_session_admin_scope`) ile tasınır. API `assertAdminScope` / `assertAdminFinanceScope` / `assertAdminSupportScope` ile zorlanır.

### Admin takip panosu

- `/admin`: operasyon ozeti, aksiyon KPI, 7 gun gelir ozeti.
- `/admin/merkez`: gunluk checklist (localStorage), SLA eskalasyon, funnel alarm, smoke gecmisi, haftalik rapor sonraki adimlar.
- `/admin/courses?tab=applications&pending=1`: global kurs basvuru kuyrugu.

### Audit beklentisi

Asagidaki admin aksiyonlari `admin_audit_events` tablosuna yazilmali:

- Rol ve hesap durumu degisikligi
- Odeme mutabakat cozumu
- Havale onayi ve cuzdan grant
- Kurs basvuru kararlari

Cookie oturumu ile gelen admin isteklerinde CSRF zorunludur; proxy `/api/admin/*` uzerinden gider.

## Kapatma Kriteri

Guvenlik maddesi ancak su kosullarda kapanir:

- Kod degisikligi test edildi.
- Risk ve geriye uyumluluk notu yazildi.
- Production env/runbook etkisi belirlendi.
- Kritik akissa audit veya alarm kapsami kontrol edildi.
