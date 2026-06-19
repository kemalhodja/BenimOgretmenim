BEGIN;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'btree_gist extension skipped (insufficient privilege)';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_trgm extension skipped (insufficient privilege)';
END $$;

-- Öğretmen: anlık ders hazırlığı
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS instant_lesson_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instant_ready_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_presence_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_teachers_instant_ready
  ON teachers (instant_lesson_available, instant_ready_until DESC NULLS LAST)
  WHERE instant_lesson_available = true;

-- Anlık özel ders (10-15 dk)
CREATE TABLE IF NOT EXISTS instant_lesson_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  branch_id INT REFERENCES branches (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'funded', 'in_progress', 'completed', 'cancelled')),
  duration_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 5 AND 30),
  agreed_amount_minor INT NOT NULL CHECK (agreed_amount_minor >= 500),
  meeting_url TEXT,
  funded_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  teacher_payout_minor INT,
  guardian_credit_pool_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instant_lesson_student
  ON instant_lesson_sessions (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instant_lesson_teacher_status
  ON instant_lesson_sessions (teacher_id, status, created_at DESC);

-- Veli güvenli havuz: aylık ders kredisi
CREATE TABLE IF NOT EXISTS guardian_lesson_credit_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  monthly_lesson_credits INT NOT NULL CHECK (monthly_lesson_credits >= 0),
  credits_remaining INT NOT NULL CHECK (credits_remaining >= 0),
  per_lesson_budget_minor INT NOT NULL CHECK (per_lesson_budget_minor >= 500),
  wallet_hold_id UUID REFERENCES user_wallet_holds (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guardian_user_id, student_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_guardian_credit_pools_guardian
  ON guardian_lesson_credit_pools (guardian_user_id, period_month DESC);

-- Haftalık AI veli raporu
CREATE TABLE IF NOT EXISTS guardian_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_title TEXT NOT NULL,
  report_body TEXT NOT NULL,
  report_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'skipped', 'failed')),
  dedupe_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_weekly_reports_guardian
  ON guardian_weekly_reports (guardian_user_id, week_start DESC);

-- Zigo flywheel: öğretmen içerik senkronu (ileri entegrasyon)
CREATE TABLE IF NOT EXISTS teacher_zigo_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_kind TEXT NOT NULL DEFAULT 'tip'
    CHECK (content_kind IN ('tip', 'formula', 'video', 'post')),
  external_url TEXT,
  branch_slug TEXT,
  target_exam TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_zigo_teacher
  ON teacher_zigo_content_links (teacher_id, published_at DESC);

-- Performans indeksleri
DO $$
BEGIN
  IF to_regclass('public.curriculum_test_questions') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_curriculum_outcome_title_trgm
      ON curriculum_test_questions USING gin (outcome_title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_curriculum_unit_title_trgm
      ON curriculum_test_questions USING gin (unit_title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS idx_curriculum_branch_grade
      ON curriculum_test_questions (branch_slug, grade_level, status)
      WHERE status = 'published';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teachers_verified_city_rating
  ON teachers (verification_status, city_id, rating_avg DESC NULLS LAST)
  WHERE verification_status = 'verified';

CREATE INDEX IF NOT EXISTS idx_teacher_branches_branch_primary
  ON teacher_branches (branch_id, is_primary DESC, teacher_id);

DO $$
BEGIN
  IF to_regclass('public.teacher_outcome_tags') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_teacher_outcome_tags_title_trgm
      ON teacher_outcome_tags USING gin (outcome_title gin_trgm_ops);
  END IF;
END $$;

-- Randevu çakışması: öğretmen + zaman aralığı (güvenli havuz / takvim)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'direct_booking_teacher_slot_excl'
  ) AND to_regclass('public.direct_lesson_bookings') IS NOT NULL THEN
    BEGIN
      ALTER TABLE direct_lesson_bookings
        ADD CONSTRAINT direct_booking_teacher_slot_excl
        EXCLUDE USING gist (
          teacher_id WITH =,
          tstzrange(
            scheduled_start,
            coalesce(scheduled_end, scheduled_start + interval '1 hour'),
            '[)'
          ) WITH &&
        )
        WHERE (
          scheduled_start IS NOT NULL
          AND status IN ('pending_funding', 'funded')
        );
    EXCEPTION
      WHEN undefined_object OR invalid_parameter_value OR feature_not_supported THEN
        RAISE NOTICE 'direct_booking_teacher_slot_excl skipped: %', SQLERRM;
    END;
  END IF;
END $$;

COMMIT;
