BEGIN;

ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount_minor INT NOT NULL DEFAULT 0 CHECK (refund_amount_minor >= 0),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE course_enrollments
  DROP CONSTRAINT IF EXISTS course_enrollments_payment_status_check;

ALTER TABLE course_enrollments
  ADD CONSTRAINT course_enrollments_payment_status_check
  CHECK (payment_status IN (
    'free',
    'wallet_held',
    'wallet_charged',
    'external_paid',
    'manual',
    'cancelled',
    'refunded'
  ));

CREATE INDEX IF NOT EXISTS idx_course_enrollments_cancelled_at
  ON course_enrollments (cancelled_at DESC)
  WHERE cancelled_at IS NOT NULL;

COMMIT;
