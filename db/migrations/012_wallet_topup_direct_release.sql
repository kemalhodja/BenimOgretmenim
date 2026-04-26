-- Cüzdan PayTR yükleme + doğrudan ders rezervasyonu için zaman damgaları
-- Önkoşul: 007 (payment_method, payment_state), 011 (user_wallets, direct_lesson_bookings)

BEGIN;

CREATE TABLE wallet_topup_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_minor INT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  method payment_method NOT NULL DEFAULT 'paytr_iframe',
  state payment_state NOT NULL DEFAULT 'pending',
  merchant_oid TEXT UNIQUE,
  paytr_iframe_token TEXT,
  paytr_status TEXT,
  paytr_total_amount_minor INT,
  paytr_raw_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_topup_merchant ON wallet_topup_payments (merchant_oid);
CREATE INDEX idx_wallet_topup_user_time ON wallet_topup_payments (user_id, created_at DESC);

ALTER TABLE direct_lesson_bookings
  ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS teacher_payout_minor INT;

COMMIT;
