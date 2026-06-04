# QA Kontrol Akışı

Bu proje için hızlı regression kontrolü:

```powershell
npm run qa:core
```

Bu komut şunları sırayla çalıştırır:

- API unit/regression testleri
- API TypeScript build
- Web ESLint
- Web production build

Daha geniş kontroller:

```powershell
npm run smoke:suite
npm run test:e2e:public
```

`smoke:suite` canlı API ve veritabanı ister. `test:e2e:public` web build/start üzerinden kamuya açık sayfaları kontrol eder.

Release öncesi admin/ödeme kontrolleri:

```powershell
npm run migrate --prefix apps/api
npm run smoke:suite --prefix apps/api
```

- `GET /v1/admin/system-health` içinde `payment_ops` kontrolü `ok` olmalı.
- PayTR staging callback denemesinde `payment_reconciliation_events` kaydı oluşmalı.
- Kritik admin aksiyonlarından sonra `GET /v1/admin/audit-events` yeni olayı göstermeli.
- Havale onayı, rol değişimi, öğretmen doğrulama ve iptal işlemlerinde audit kaydı beklenir.
