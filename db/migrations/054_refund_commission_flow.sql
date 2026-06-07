BEGIN;

ALTER TABLE teacher_campaigns
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'listing_fee',
  ADD COLUMN IF NOT EXISTS success_fee_bps INT NOT NULL DEFAULT 1000 CHECK (success_fee_bps BETWEEN 0 AND 10000);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_campaigns_billing_model_check'
  ) THEN
    ALTER TABLE teacher_campaigns
      ADD CONSTRAINT teacher_campaigns_billing_model_check
      CHECK (billing_model IN ('listing_fee', 'success_fee'));
  END IF;
END $$;

ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS refund_eligibility_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_decided_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_refund_eligibility_status_check'
  ) THEN
    ALTER TABLE course_enrollments
      ADD CONSTRAINT course_enrollments_refund_eligibility_status_check
      CHECK (
        refund_eligibility_status IN (
          'not_started',
          'eligible_after_first',
          'refund_requested',
          'locked_after_second',
          'refunded',
          'expired',
          'legacy_no_fee'
        )
      );
  END IF;
END $$;

ALTER TABLE course_teacher_payouts
  ADD COLUMN IF NOT EXISTS platform_fee_minor INT NOT NULL DEFAULT 0 CHECK (platform_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS teacher_net_amount_minor INT NOT NULL DEFAULT 0 CHECK (teacher_net_amount_minor >= 0),
  ADD COLUMN IF NOT EXISTS success_fee_bps INT NOT NULL DEFAULT 1000 CHECK (success_fee_bps BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS refund_lock_status TEXT NOT NULL DEFAULT 'legacy_no_fee',
  ADD COLUMN IF NOT EXISTS payable_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_teacher_payouts_refund_lock_status_check'
  ) THEN
    ALTER TABLE course_teacher_payouts
      ADD CONSTRAINT course_teacher_payouts_refund_lock_status_check
      CHECK (refund_lock_status IN ('pending_refund_window', 'locked_after_second', 'refunded', 'legacy_no_fee'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_course_enrollments_refund_status
  ON course_enrollments (refund_eligibility_status, refund_requested_at);

CREATE INDEX IF NOT EXISTS idx_course_teacher_payouts_refund_lock
  ON course_teacher_payouts (refund_lock_status, status, payable_after);

UPDATE course_teacher_payouts
SET teacher_net_amount_minor = amount_minor
WHERE teacher_net_amount_minor = 0
  AND amount_minor > 0
  AND platform_fee_minor = 0;

COMMIT;
