-- Öğretmen ders / sınav hazırlık videoları — sınıf, branş, konu, kazanım ile etiketlenir.

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_lesson_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  grade_level SMALLINT NOT NULL CHECK (grade_level >= 1 AND grade_level <= 12),
  branch_id INT NOT NULL REFERENCES branches (id),
  topic_title TEXT NOT NULL,
  outcome_code TEXT NOT NULL,
  outcome_title TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  video_kind TEXT NOT NULL DEFAULT 'lesson'
    CHECK (video_kind IN ('lesson', 'exam_prep')),
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT teacher_lesson_videos_url_https CHECK (video_url ~* '^https://')
);

CREATE INDEX IF NOT EXISTS idx_teacher_lesson_videos_grade_branch
  ON teacher_lesson_videos (grade_level, branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_lesson_videos_teacher
  ON teacher_lesson_videos (teacher_id, status, created_at DESC);

COMMIT;
