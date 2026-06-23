# Google Play — TWA Yayın Kontrol Listesi

Android TWA (`apps/twa-android`) için mağaza yayını adımları. Politika formları: `PLAY_CONSOLE_COMPLIANCE.md`. Mağaza metinleri: `PLAY_STORE_LISTING.md`.

## Ön koşullar

- [ ] `benimogretmenim.com.tr` DNS canlı (`DEPLOYMENT.md`)
- [ ] Web deploy güncel (`NEXT_PUBLIC_SITE_URL` doğru)
- [ ] Bireysel (Personal) Play geliştirici hesabı hazır

## 1) APK / AAB derleme

```bash
cd apps/twa-android
# BUILD.txt adımlarını izleyin
```

- [ ] `applicationId` = `benimogretmenim.com.tr` (değiştirmeyin)
- [ ] `versionCode` / `versionName` artırıldı
- [ ] Release imzalı AAB üretildi

CI: `.github/workflows/android-apk.yml` (PR/push tetikleyicisi).

## 2) Digital Asset Links

1. Play Console → Uygulama → **Kurulum** → **Uygulama bütünlüğü** → **App signing key certificate** SHA-256 kopyala
2. PowerShell:
   ```powershell
   cd apps/twa-android
   .\scripts\write-assetlinks.ps1 -Sha256 "AA:BB:CC:..."
   ```
3. Web deploy sonrası doğrula:

```bash
curl -s https://benimogretmenim.com.tr/.well-known/assetlinks.json
```

- [ ] JSON boş `[]` değil
- [ ] `package_name`: `benimogretmenim.com.tr`
- [ ] SHA-256 Play App Signing ile eşleşiyor

[Google Statement List Generator](https://developers.google.com/digital-asset-links/tools/generator) ile test edilebilir.

## 3) Play Console — Uygulama içeriği

`PLAY_CONSOLE_COMPLIANCE.md` sırasıyla:

- [ ] Finansal özellikler → **sunmuyor**
- [ ] Sağlık → **sunmuyor**
- [ ] Veri güvenliği formu (e-posta, ödeme işlemcisi, çerez)
- [ ] Hedef kitle ve içerik derecelendirme
- [ ] Gizlilik politikası URL: `https://benimogretmenim.com.tr/gizlilik`

## 4) Mağaza girişi

`PLAY_STORE_LISTING.md`:

- [ ] Kısa / uzun açıklama (finansal cüzdan vurgusu yok)
- [ ] Ekran görüntüleri (telefon)
- [ ] Feature graphic + ikon
- [ ] Kategori: Eğitim

## 5) İnceleme notu (Internal testing → Production)

Önerilen metin: `play-review-notes-en.txt`

Production inceleme hesapları:
```bash
PLAY_REVIEW_PASSWORD='...' npm run db:seed:play-review --prefix apps/api
```

- [ ] Test hesabı veya demo URL inceleme notunda
- [ ] Internal test → kapalı test → production sırası

## 6) Yayın sonrası

- [ ] `NEXT_PUBLIC_PLAY_STORE_URL` Render web env’e ekle (ör. `https://play.google.com/store/apps/details?id=benimogretmenim.com.tr`)
- [ ] `/uygulama` sayfasında Play badge görünüyor
- [ ] TWA tam ekran açılıyor (assetlinks doğruysa)
- [ ] `SEO_LAUNCH_CHECKLIST.md` TWA maddesi işaretlendi

## Sorun giderme

| Belirti | Olası neden |
|---------|-------------|
| Chrome custom tab, tam ekran değil | `assetlinks.json` eksik/yanlış SHA |
| Play “kurumsal hesap” reddi | Finansal özellik formunu düzelt; `PLAY_CONSOLE_COMPLIANCE.md` |
| Site açılmıyor | DNS / Render custom domain |

Son güncelleme: 2026-06-17
