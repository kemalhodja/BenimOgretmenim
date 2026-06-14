# Payment and Finance Runbook

BenimOgretmenim gelir modeli: ogrenci platforma oder; ogretmen komisyon odemez. Platform, gerceklesen ders/kurs/hizmet icin ogretmene belirlenen hak edisi oder.

## Temel Ilkeler

- Her para hareketinin ledger veya reconciliation izi olmalidir.
- PayTR callback idempotent kabul edilir; ayni callback tekrar gelirse ikinci kez bakiye/hak edis yazilmaz.
- Amount mismatch durumunda para otomatik kullanici bakiyesine veya abonelige islenmez.
- Iade ve iptal islemleri admin audit izi olmadan kapatilmaz.
- Ogretmen odemesi, ders/kurs gerceklesme ve varsa iade/itiraz penceresi kontrol edilmeden onaylanmaz.

## PayTR Callback Kontrolu

1. `merchant_oid` ile ilgili payment tablosu bulunur.
2. Hash dogrulamasi basarisizsa islem reddedilir.
3. `status=success` ve tutar beklenen tutara esit ise payment `paid` olur.
4. Tutar uyusmazsa `payment_reconciliation_events.status = amount_mismatch` kaydi olusur.
5. `status!=success` ise payment `failed` olur, bakiye veya abonelik yazilmaz.
6. Ayni success tekrar gelirse state zaten `paid` oldugu icin yeni ledger/subscription yazilmaz.

## Cuzdan Yukleme

1. Basarili PayTR callback sonrasi `wallet_topup_payments.state=paid`.
2. `user_wallet_ledger.kind=paytr_wallet_topup` tek kayit olmalidir.
3. `user_wallets.balance_minor` beklenen tutar kadar artmalidir.
4. Failed veya amount mismatch durumunda bakiye artmamalidir.

## Kurs / Ders Tahsilati

1. Ogrenci bakiyesi/blokesi kontrol edilir.
2. Ders veya kurs baslangic kosulu saglaninca blokeli tutar tahsil edilir.
3. Ogretmen hak edisi, platform gelir modeliyle uyumlu net tutardan hesaplanir.
4. Iptal/iade halinde ledger'a tek iade kaydi yazilir.
5. Ayni iade islemi ikinci kez calistirilsa ledger tekrarlanmamalidir.

## Ogretmen Hak Edisi ve Para Cekme

1. Talep sahibi ogretmenin user ve teacher kaydi dogrulanir.
2. Hak edis bakiyesi ile withdrawal tutari karsilastirilir.
3. Banka bilgisi ve kimlik/dogrulama durumu kontrol edilir.
4. Admin onayi audit'e yazilir.
5. Odeme yapildiktan sonra withdrawal status ve aciklama guncellenir.

## Iade / Dispute Sureci

1. Kullanici talebi destek kaydina baglanir.
2. Ilgili payment, wallet ledger, ders/kurs kaydi ve admin audit kaydi toplanir.
3. Iade uygunsa once sistem kaydi guncellenir, sonra odeme saglayici islemi yapilir.
4. Iade uygun degilse gerekce destek kaydina yazilir.
5. Chargeback/dispute varsa ilgili kullanici ve ogretmen hesaplari risk etiketiyle takip edilir.

## Finansal Mutabakat

Haftalik export veya manuel sorguda su alanlar karsilastirilir:

- PayTR merchant oid
- payment table/id
- expected amount
- received amount
- wallet ledger delta
- subscription/course/enrollment state
- refund amount
- teacher payout state
- admin audit action

## Test Kapsami

Asgari testler:

- invalid hash payment state degistirmez.
- unknown merchant oid reconciliation event yazar.
- duplicate success tek ledger/subscription yazar.
- amount mismatch bakiye/abonelik yazmaz.
- failed callback payment'i failed yapar ve bakiye yazmaz.
- iade iki kez calissa tek ledger kaydi kalir.
