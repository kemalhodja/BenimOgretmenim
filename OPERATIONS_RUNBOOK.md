# BenimOgretmenim Operations Runbook

Bu runbook, admin/destek ekibinin kritik SaaS operasyonlarını aynı sırayla ve denetlenebilir şekilde yürütmesi için tutulur.

## Günlük Kontrol

1. Admin panelde `Sistem sagligi` kontrol edilir.
2. `payment_ops` degraded ise once audit/reconciliation hatasi incelenir.
3. `payment-reconciliation` listesinde `unknown_merchant_oid`, `amount_mismatch`, `failed` kayitlari filtrelenir.
4. Ogretmen para cekme talepleri banka bilgisi, hak edis ve audit gecmisiyle karsilastirilir.
5. Destek kuyruğunda odeme, iade, ders gerceklesmedi ve hesap erisimi basliklari onceliklendirilir.

## Haftalik Kontrol

1. Cuzdan ledger bakiyesi ile odeme/iadeler karsilastirilir.
2. Ogretmen hak edisleri ders gerceklesme kayitlariyla orneklemeli dogrulanir.
3. Basarisiz PayTR callback ve gec callback sayilari raporlanir.
4. Admin audit olaylarinda finansal islem yapan hesaplar gozden gecirilir.
5. Sistem health ve smoke run sonuclari saklanir.

## Olay Seviyeleri

- P0: Para kaybi, yetkisiz finans islemi, genis kullanici giris problemi, veri sizintisi.
- P1: Odeme/iade akisi kismi bozuk, admin mutabakat degraded, ogretmen hak edisi gecikiyor.
- P2: Tekil kullanici destek problemi, UI hatasi, gecici bildirim problemi.

## P0 Olay Adimlari

1. Yeni deploy durdurulur.
2. Admin finans aksiyonlari gecici olarak sadece tek yetkili adminle sinirlandirilir.
3. Ilgili `requestId`, kullanici id, payment id, merchant oid ve audit event id toplanir.
4. Reconciliation kaydi yoksa manuel kayit acilir veya olay notu admin audit'e eklenir.
5. Sorun giderilene kadar kullaniciya net durum ve sonraki kontrol zamani bildirilir.
6. Cozumden sonra olay postmortem'i yazilir: sebep, etki, geri alma, kalici onlem.

## Rollback

1. Son deploy commit'i tespit edilir.
2. Migration calistiysa veri geri uyumlulugu kontrol edilir; destructive rollback elle yapilmaz.
3. Render/GitHub uzerinden onceki saglam release'e donulur.
4. `/health`, `/v1/admin/system-health`, login, odeme callback smoke ve panel smoke kontrol edilir.

## Backup / Restore

1. Production veritabani yedekleme zamani gunluk kontrol edilir.
2. Ayda en az bir kez staging veya lokal ortamda restore testi yapilir.
3. Restore testinde kullanici, odeme, wallet ledger, audit event ve migration checksum tablolari kontrol edilir.

## Kapatma Kriteri

Bir operasyon isi ancak su kosullarda kapanir:

- Kullanici/odeme kaydi beklenen son durumda.
- Admin audit veya reconciliation izi mevcut.
- Destek notu ve gerekiyorsa kullanici bildirimi yazildi.
- Tekrarini onleyen test, alarm veya runbook maddesi eklendi.
