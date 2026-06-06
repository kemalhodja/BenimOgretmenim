-- Explicit PayTR idempotency and amount safety constraints across all callback tables.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_payments_merchant_oid_not_null
  ON subscription_payments (merchant_oid)
  WHERE merchant_oid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_enrollment_payments_merchant_oid_not_null
  ON course_enrollment_payments (merchant_oid)
  WHERE merchant_oid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_sub_payments_merchant_oid_not_null
  ON student_sub_payments (merchant_oid)
  WHERE merchant_oid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_topup_payments_merchant_oid_not_null
  ON wallet_topup_payments (merchant_oid)
  WHERE merchant_oid IS NOT NULL;

ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_merchant_oid_not_blank
    CHECK (merchant_oid IS NULL OR length(trim(merchant_oid)) > 0),
  ADD CONSTRAINT subscription_payments_paytr_total_nonnegative
    CHECK (paytr_total_amount_minor IS NULL OR paytr_total_amount_minor >= 0);

ALTER TABLE course_enrollment_payments
  ADD CONSTRAINT course_enrollment_payments_merchant_oid_not_blank
    CHECK (merchant_oid IS NULL OR length(trim(merchant_oid)) > 0),
  ADD CONSTRAINT course_enrollment_payments_paytr_total_nonnegative
    CHECK (paytr_total_amount_minor IS NULL OR paytr_total_amount_minor >= 0);

ALTER TABLE student_sub_payments
  ADD CONSTRAINT student_sub_payments_merchant_oid_not_blank
    CHECK (merchant_oid IS NULL OR length(trim(merchant_oid)) > 0),
  ADD CONSTRAINT student_sub_payments_paytr_total_nonnegative
    CHECK (paytr_total_amount_minor IS NULL OR paytr_total_amount_minor >= 0);

ALTER TABLE wallet_topup_payments
  ADD CONSTRAINT wallet_topup_payments_merchant_oid_not_blank
    CHECK (merchant_oid IS NULL OR length(trim(merchant_oid)) > 0),
  ADD CONSTRAINT wallet_topup_payments_paytr_total_nonnegative
    CHECK (paytr_total_amount_minor IS NULL OR paytr_total_amount_minor >= 0);

COMMIT;
