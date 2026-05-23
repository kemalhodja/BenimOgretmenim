-- Demo ders talepleri: öğrenci, öğretmen profilinden hedefli demo talebi açabilir.

BEGIN;

ALTER TABLE lesson_requests
  ADD COLUMN IF NOT EXISTS request_kind TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS target_teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE lesson_requests
    ADD CONSTRAINT lesson_requests_request_kind_check
    CHECK (request_kind IN ('regular', 'demo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lesson_requests_target_teacher
  ON lesson_requests (target_teacher_id, status, created_at DESC);

COMMIT;
