-- Öğretmen aboneliği: 6 aylık / yıllık; kampanya: satın alınan sürenin 2 katı kadar hediye (toplam süre x2)
-- Önkoşul: 001_core_schema.sql

BEGIN;

CREATE TYPE subscription_plan_code AS ENUM ('teacher_6m', 'teacher_12m');
CREATE TYPE teacher_subscription_status AS ENUM ('active', 'expired', 'cancelled');

CREATE TABLE subscription_plans (
  code subscription_plan_code PRIMARY KEY,
  title TEXT NOT NULL,
  duration_months INT NOT NULL CHECK (duration_months > 0),
  price_minor INT NOT NULL CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  entitlements_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Başlangıç planları (idempotent)
INSERT INTO subscription_plans (code, title, duration_months, price_minor, currency, entitlements_jsonb)
SELECT 'teacher_6m', '6 Aylık Öğretmen Aboneliği', 6, 200000, 'TRY',
       '{"unlimited_offers": true, "academy_teaching_access": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'teacher_6m');

INSERT INTO subscription_plans (code, title, duration_months, price_minor, currency, entitlements_jsonb)
SELECT 'teacher_12m', 'Yıllık Öğretmen Aboneliği', 12, 300000, 'TRY',
       '{"unlimited_offers": true, "academy_teaching_access": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'teacher_12m');

CREATE TABLE teacher_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  plan_code subscription_plan_code NOT NULL REFERENCES subscription_plans (code) ON DELETE RESTRICT,
  status teacher_subscription_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  promo_multiplier INT NOT NULL DEFAULT 2 CHECK (promo_multiplier >= 1 AND promo_multiplier <= 10),
  paid_amount_minor INT NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  payment_provider TEXT,
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_subs_teacher_status ON teacher_subscriptions (teacher_id, status, expires_at DESC);

COMMIT;

