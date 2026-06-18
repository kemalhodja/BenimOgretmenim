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
2. `apps/twa-android/assetlinks.template.json` → `apps/web/public/.well-known/assetlinks.json` (REPLACE satırını doldur)
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

Önerilen metin (İngilizce):

> Trusted Web Activity for benimogretmenim.com.tr — education marketplace for private tutoring. No in-app billing; payments via PayTR on the website. Test account: [e-posta] / [şifre veya demo talimatı].

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
