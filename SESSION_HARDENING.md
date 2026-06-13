# Session Hardening Migration

Bu not, web token'ının `localStorage` yerine HttpOnly cookie/session modeline taşınması için ayrı bir migration kapsamıdır. İlk eksik giderme turunda oturum mimarisi bilerek değiştirilmedi; production config, audit görünürlüğü ve rate limit sertleştirmesi önce tamamlandı.

## Neden

- `localStorage` içindeki bearer token XSS durumunda doğrudan okunabilir.
- Admin, ödeme, cüzdan ve öğretmen hak ediş ekranları yüksek etkili işlemler içerir.
- HttpOnly cookie, token okuma yüzeyini daraltır ve web/API oturum sözleşmesini daha profesyonel SaaS seviyesine taşır.

## Hedef Davranış

- Giriş ve kayıt sonrası access token client JavaScript'e dönmek yerine HttpOnly, Secure, SameSite cookie olarak set edilir.
- Web `apiFetch` varsayılan olarak cookie credentials ile çalışır.
- API tarafı `Authorization: Bearer` desteğini migration boyunca koruyabilir; web panel route'ları cookie oturumunu birincil yol yapar.
- Çıkış cookie'yi server response ile temizler.
- Admin proxy route'ları upstream'e güvenli server-side header üretir; client localStorage token'ına ihtiyaç kalmaz.

## Uygulama Fazları

1. API auth response'larına cookie set/clear yardımcıları ekle.
2. Web login/register/logout akışlarını cookie tabanlı hale getir.
3. `apps/web/app/lib/auth.ts` ve `apiFetch` kullanımını kademeli olarak token parametresinden cookie credentials'a taşı.
4. Admin proxy route'larında `authorization` header bağımlılığını cookie session doğrulamasına çevir.
5. Role guard ve Playwright role journey testlerini cookie modeline göre güncelle.
6. Migration tamamlanınca web `localStorage` token okuma/yazma kodunu kaldır.

## Test Kapısı

- API auth unit/integration testleri: login, register, me, logout.
- Web E2E: öğrenci, öğretmen, veli, admin panel girişleri.
- Güvenlik regresyonu: cookie flags `HttpOnly`, `Secure` production, `SameSite=Lax` veya daha sıkı politika.
- Admin operasyon smoke: payment reconciliation, wallet ops, system health ve quality report proxy'leri.

## Riskler

- Cross-origin web/API deployment cookie domain ve SameSite ayarlarını etkiler.
- Mobile/webview kullanımında cookie davranışı ayrıca doğrulanmalı.
- Kademeli geçiş sürecinde bearer ve cookie desteği aynı anda açık kalırsa yetki kontrolleri tek doğrulama helper'ında tutulmalı.
