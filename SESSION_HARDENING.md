# Session Hardening Migration

Bu not, web token'ının `localStorage` yerine HttpOnly cookie/session modeline taşınması için migration kapsamıdır. İlk adım tamamlandı: API artık login/register sonrası HttpOnly `bo_session` cookie set eder, `requireAuth` bearer token yoksa cookie okuyabilir ve cookie ile yapılan unsafe isteklerde CSRF header zorunludur.

## Neden

- `localStorage` içindeki bearer token XSS durumunda doğrudan okunabilir.
- Admin, ödeme, cüzdan ve öğretmen hak ediş ekranları yüksek etkili işlemler içerir.
- HttpOnly cookie, token okuma yüzeyini daraltır ve web/API oturum sözleşmesini daha profesyonel SaaS seviyesine taşır.

## Hedef Davranış

- Giriş ve kayıt sonrası access token client JavaScript'e dönmek yerine HttpOnly, Secure, SameSite cookie olarak set edilir.
- Web `apiFetch` varsayılan olarak cookie credentials ile çalışır.
- API tarafı `Authorization: Bearer` desteğini migration boyunca korur; web panel route'ları kademeli olarak cookie oturumunu birincil yol yapar.
- Çıkış cookie'yi server response ile temizler.
- Admin proxy route'ları upstream'e güvenli server-side header üretir; client localStorage token'ına ihtiyaç kalmaz.
- Cookie-authenticated `POST`, `PUT`, `PATCH` ve `DELETE` istekleri `x-csrf-token` header'ı olmadan kabul edilmez.

## Uygulama Fazları

1. Tamamlandı: API auth response'larına cookie set/clear yardımcıları eklendi.
2. Tamamlandı: `requireAuth` bearer öncelikli, cookie fallback destekli hale geldi.
3. Tamamlandı: `apiFetch` `credentials: include` ve CSRF header gönderecek şekilde hazırlandı.
4. Tamamlandı: `auth.ts` cookie-first; JWT localStorage'a yazılmaz; `commitAuthSession()` login/kayıt sonrası.
5. Tamamlandı: Admin proxy cookie oturumunu kabul eder (`hasAdminProxySession`).
6. Tamamlandı: Playwright oturum testleri cookie modelini doğrular.
7. Tamamlandı: `bo:token` localStorage okuma kaldırıldı; yalnızca HttpOnly cookie + rol önbelleği.

## Test Kapısı

- API auth unit/integration testleri: login, register, me, logout.
- API middleware testleri: cookie fallback, bearer önceliği, CSRF reddi ve CSRF kabulü.
- Web E2E: öğrenci, öğretmen, veli, admin panel girişleri.
- Güvenlik regresyonu: cookie flags `HttpOnly`, `Secure` production, `SameSite=Lax` veya daha sıkı politika.
- Admin operasyon smoke: payment reconciliation, wallet ops, system health ve quality report proxy'leri.

## Riskler

- Cross-origin web/API deployment cookie domain ve SameSite ayarlarını etkiler.
- Mobile/webview kullanımında cookie davranışı ayrıca doğrulanmalı.
- Kademeli geçiş sürecinde bearer ve cookie desteği aynı anda açık kalırsa yetki kontrolleri tek doğrulama helper'ında tutulmalı.
