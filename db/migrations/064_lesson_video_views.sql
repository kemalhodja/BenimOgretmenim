-- Öğrenci video izleme kaydı (öğretmen performansı + tekrar izleme sayısı)

BEGIN;

CREATE TABLE IF NOT EXISTS lesson_video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES teacher_lesson_videos (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  first_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  watch_count INT NOT NULL DEFAULT 1 CHECK (watch_count > 0),
  UNIQUE (video_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_video_views_video
  ON lesson_video_views (video_id, last_watched_at DESC);

COMMIT;
