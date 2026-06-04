-- Early access teacher subscription campaign:
-- - 6 months paid + 24 months gift = 30 months total
-- - 12 months paid + 48 months gift = 60 months total
-- Application default SUB_PROMO_MULTIPLIER is 5 for these plans.

BEGIN;

UPDATE subscription_plans
SET title = '6 Aylık Öğretmen Aboneliği (Erken Erişim: +2 Yıl)',
    entitlements_jsonb = entitlements_jsonb || jsonb_build_object(
      'early_access_gift_months', 24,
      'campaign_total_months', 30
    )
WHERE code = 'teacher_6m';

UPDATE subscription_plans
SET title = '12 Aylık Öğretmen Aboneliği (Erken Erişim: +4 Yıl)',
    entitlements_jsonb = entitlements_jsonb || jsonb_build_object(
      'early_access_gift_months', 48,
      'campaign_total_months', 60
    )
WHERE code = 'teacher_12m';

COMMIT;
