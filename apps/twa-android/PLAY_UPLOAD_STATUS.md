# Play yayın durumu

Son güncelleme: 2026-06-26

## Tamamlanan

- [x] Upload keystore (`apps/twa-android/upload-keystore.jks`)
- [x] GitHub Actions signing secret'ları
- [x] Signed AAB — `apps/twa-android/dist/app-release.aab` (CI run [28205228227](https://github.com/kemalhodja/BenimOgretmenim/actions/runs/28205228227), ~3.5 MB)
- [x] `assetlinks.json` — upload key SHA (Play SHA sonrası `-Append` ile ekle)
- [x] Gizlilik ve kullanım koşulları sayfaları güncellendi
- [x] `PLAY_DATA_SAFETY.md` — Data Safety form cevapları
- [x] Play inceleme seed: `npm run db:seed:play-review --prefix apps/api`

## Sizin yapmanız gereken (Play Console)

1. [Play Console](https://play.google.com/console) → Internal testing → `dist/app-release.aab` yükle
2. **App signing key certificate** SHA-256 → assetlinks'e ekle:
   ```powershell
   cd apps/twa-android
   .\scripts\write-assetlinks.ps1 -Sha256 "PLAY_SHA_BURAYA" -Append
   ```
3. Web deploy (Render) — gizlilik + assetlinks canlıya çıksın
4. Production DB: `PLAY_REVIEW_PASSWORD='...' npm run db:seed:play-review --prefix apps/api`
5. `PLAY_CONSOLE_COMPLIANCE.md` + `PLAY_DATA_SAFETY.md` formları
6. İsteğe bağlı Render env: `NEXT_PUBLIC_LEGAL_ENTITY_NAME`, `NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS`

## Not

Geçerli keystore: `apps/twa-android/upload-keystore.jks` + GitHub secret'ları.
