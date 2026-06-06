BEGIN;

CREATE TABLE IF NOT EXISTS course_teacher_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES course_cohorts (id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES course_sessions (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
  teacher_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  hourly_rate_minor INT NOT NULL CHECK (hourly_rate_minor >= 0),
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  amount_minor INT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'wallet_paid', 'skipped')),
  paid_at TIMESTAMPTZ,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_course_teacher_payouts_course
  ON course_teacher_payouts (course_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_teacher_payouts_teacher
  ON course_teacher_payouts (teacher_id, status, created_at DESC);

COMMIT;
