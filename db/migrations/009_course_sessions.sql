-- Kurs cohort ders oturumları (online dershane takvimi)
-- Önkoşul: 008_online_courses.sql

BEGIN;

CREATE TYPE course_session_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled_by_teacher',
  'cancelled_by_student'
);

CREATE TABLE course_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES course_cohorts (id) ON DELETE CASCADE,
  session_index SMALLINT NOT NULL CHECK (session_index > 0),
  title TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  duration_minutes SMALLINT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  delivery_mode lesson_delivery_mode NOT NULL DEFAULT 'online',
  meeting_url TEXT,
  status course_session_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, session_index)
);

CREATE INDEX idx_course_sessions_cohort ON course_sessions (cohort_id, session_index);

COMMIT;
