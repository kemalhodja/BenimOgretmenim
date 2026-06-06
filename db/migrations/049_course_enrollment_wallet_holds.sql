BEGIN;

ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS price_minor INT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'TRY',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS wallet_hold_id UUID REFERENCES user_wallet_holds (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS charged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_payment_status_check'
  ) THEN
    ALTER TABLE course_enrollments
      ADD CONSTRAINT course_enrollments_payment_status_check
      CHECK (payment_status IN ('free', 'wallet_held', 'wallet_charged', 'external_paid', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_enrollments_payment_status
  ON course_enrollments (payment_status, charged_at);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_wallet_hold
  ON course_enrollments (wallet_hold_id);

COMMIT;
