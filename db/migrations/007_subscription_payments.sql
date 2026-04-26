-- Abonelik ödemeleri: PayTR (iframe) + Havale/EFT (manuel onay)

BEGIN;

CREATE TYPE payment_method AS ENUM ('paytr_iframe', 'bank_transfer');
CREATE TYPE payment_state AS ENUM ('pending', 'paid', 'failed', 'cancelled');

CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  plan_code subscription_plan_code NOT NULL REFERENCES subscription_plans (code) ON DELETE RESTRICT,
  method payment_method NOT NULL,
  state payment_state NOT NULL DEFAULT 'pending',
  amount_minor INT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',

  -- PayTR
  merchant_oid TEXT UNIQUE,
  paytr_iframe_token TEXT,
  paytr_status TEXT,
  paytr_total_amount_minor INT,
  paytr_raw_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Bank transfer
  bank_ref TEXT,
  bank_note TEXT,
  approved_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_payments_teacher_time ON subscription_payments (teacher_id, created_at DESC);
CREATE INDEX idx_sub_payments_state ON subscription_payments (state, created_at DESC);

-- teacher_subscriptions ile ödeme bağlantısı (sonradan takip için)
ALTER TABLE teacher_subscriptions
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES subscription_payments (id) ON DELETE SET NULL;

COMMIT;

