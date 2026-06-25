-- Ders video moderasyonu — admin onayı olmadan öğrenciye düşmez.

BEGIN;

ALTER TABLE teacher_lesson_videos
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (moderation_status IN ('pending_review', 'approved', 'rejected', 'flagged')),
  ADD COLUMN IF NOT EXISTS moderation_note TEXT,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by_user_id UUID REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_teacher_lesson_videos_moderation
  ON teacher_lesson_videos (moderation_status, status, created_at DESC);

-- Mevcut yayınlanmış videoları onaylı say (geriye dönük uyum)
UPDATE teacher_lesson_videos
SET moderation_status = 'approved'
WHERE status = 'published' AND moderation_status = 'pending_review';

COMMIT;
