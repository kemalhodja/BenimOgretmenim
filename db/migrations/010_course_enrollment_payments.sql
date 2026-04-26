-- Kurs ücreti: PayTR ile ödeme, başarıda cohort kaydı
-- Önkoşul: 007_subscription_payments.sql (payment_method, payment_state), 008_online_courses.sql

BEGIN;

CREATE TABLE course_enrollment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES course_cohorts (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
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
  fulfillment_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_enr_pay_student ON course_enrollment_payments (student_id, created_at DESC);
CREATE INDEX idx_course_enr_pay_state ON course_enrollment_payments (state, created_at DESC);
CREATE INDEX idx_course_enr_pay_merchant ON course_enrollment_payments (merchant_oid) WHERE merchant_oid IS NOT NULL;

-- Aynı cohort için aynı anda yalnızca bir bekleyen ödeme
CREATE UNIQUE INDEX uq_course_enr_pay_pending_cohort_student
  ON course_enrollment_payments (cohort_id, student_id)
  WHERE state = 'pending';

COMMIT;
