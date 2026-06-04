-- Classroom attendance and homework quality moderation audit.

BEGIN;

CREATE TABLE IF NOT EXISTS classroom_attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lesson_session', 'course_session')),
  subject_id UUID NOT NULL,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  display_name_snapshot TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('join', 'leave', 'heartbeat')),
  client_meta_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_attendance_subject_time
  ON classroom_attendance_events (subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_classroom_attendance_user_time
  ON classroom_attendance_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS homework_quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES student_homework_posts (id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  quality_score SMALLINT CHECK (quality_score IS NULL OR quality_score BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_quality_reviews_post_time
  ON homework_quality_reviews (post_id, created_at DESC);

COMMIT;
