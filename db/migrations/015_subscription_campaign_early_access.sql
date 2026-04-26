-- Erken erişim kampanyası:
-- - 12 aylık alan: +24 ay hediye (toplam 36 ay) → promo_multiplier=3
-- - 6 aylık alan: +12 ay hediye (toplam 18 ay) → promo_multiplier=3
-- Fiyatlar:
-- - 12 ay: 2500 TL
-- - 6 ay: 1750 TL
--
-- Not: promo_multiplier uygulaması uygulama katmanında (SUB_PROMO_MULTIPLIER varsayılan=3).

BEGIN;

UPDATE subscription_plans
SET price_minor = 175000,
    title = '6 Aylık Öğretmen Aboneliği (Kampanya: +12 Ay)',
    currency = 'TRY'
WHERE code = 'teacher_6m';

UPDATE subscription_plans
SET price_minor = 250000,
    title = '12 Aylık Öğretmen Aboneliği (Kampanya: +24 Ay)',
    currency = 'TRY'
WHERE code = 'teacher_12m';

COMMIT;

