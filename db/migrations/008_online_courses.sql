-- Online dershane MVP: kurs + cohort + kayıt
-- Önkoşul: 001_core_schema.sql (users/teachers/students/lesson_delivery_mode)

BEGIN;

CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE cohort_status AS ENUM ('planned', 'active', 'completed', 'cancelled');

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  branch_id INT REFERENCES branches (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 3),
  description TEXT,
  delivery_mode lesson_delivery_mode NOT NULL DEFAULT 'online',
  language_code TEXT NOT NULL DEFAULT 'tr',
  price_minor INT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  status course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_teacher ON courses (teacher_id, created_at DESC);
CREATE INDEX idx_courses_status ON courses (status, created_at DESC);
CREATE INDEX idx_courses_branch ON courses (branch_id);

CREATE TABLE course_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 3),
  status cohort_status NOT NULL DEFAULT 'planned',
  capacity INT CHECK (capacity IS NULL OR capacity > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  schedule_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cohorts_course ON course_cohorts (course_id, created_at DESC);
CREATE INDEX idx_cohorts_status ON course_cohorts (status, starts_at);

CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES course_cohorts (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (cohort_id, student_id)
);

CREATE INDEX idx_enrollments_student_time ON course_enrollments (student_id, enrolled_at DESC);
CREATE INDEX idx_enrollments_cohort_time ON course_enrollments (cohort_id, enrolled_at DESC);

COMMIT;

