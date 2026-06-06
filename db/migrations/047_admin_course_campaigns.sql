-- Admin yönetimli kurs kampanyaları: öğretmen seçimi + öğrenci ön kayıtları
-- Önkoşul: 008_online_courses.sql, 009_course_sessions.sql

BEGIN;

ALTER TABLE courses
  ALTER COLUMN teacher_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS created_by_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'teacher_created'
    CHECK (origin IN ('teacher_created', 'admin_campaign')),
  ADD COLUMN IF NOT EXISTS teacher_hourly_rate_minor INT CHECK (
    teacher_hourly_rate_minor IS NULL OR teacher_hourly_rate_minor >= 0
  ),
  ADD COLUMN IF NOT EXISTS campaign_details_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS application_status TEXT NOT NULL DEFAULT 'closed'
    CHECK (application_status IN ('open', 'closed'));

UPDATE courses
SET origin = 'teacher_created',
    application_status = 'closed'
WHERE origin IS NULL OR origin = '';

CREATE INDEX IF NOT EXISTS idx_courses_origin_status ON courses (origin, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_admin_creator ON courses (created_by_admin_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS course_teacher_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  message TEXT,
  experience_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  decided_by_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_course_teacher_applications_course
  ON course_teacher_applications (course_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_teacher_applications_teacher
  ON course_teacher_applications (teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS course_student_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES course_cohorts (id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  goal_note TEXT,
  guardian_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_course_student_applications_course
  ON course_student_applications (course_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_student_applications_student
  ON course_student_applications (student_id, created_at DESC);

COMMIT;
