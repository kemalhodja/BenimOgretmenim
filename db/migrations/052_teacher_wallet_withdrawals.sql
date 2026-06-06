BEGIN;

CREATE TABLE IF NOT EXISTS teacher_wallet_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
  teacher_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amount_minor INT NOT NULL CHECK (amount_minor >= 10000),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  iban TEXT NOT NULL,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  admin_note TEXT,
  bank_receipt_ref TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_wallet_withdrawals_teacher
  ON teacher_wallet_withdrawals (teacher_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_wallet_withdrawals_status
  ON teacher_wallet_withdrawals (status, created_at DESC);

COMMIT;
