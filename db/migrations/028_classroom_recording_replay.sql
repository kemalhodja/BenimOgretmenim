-- Recording/replay metadata for classroom sessions.

BEGIN;

ALTER TABLE recording_assets
  ALTER COLUMN classroom_session_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subject_type TEXT CHECK (subject_type IN ('lesson_session', 'course_session')),
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS public_url TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

UPDATE recording_assets ra
SET subject_type = 'lesson_session',
    subject_id = cs.lesson_session_id,
    public_url = CASE
      WHEN ra.storage_bucket = 'external_url' THEN ra.storage_object_key
      ELSE ra.public_url
    END
FROM classroom_sessions cs
WHERE ra.classroom_session_id = cs.id
  AND (ra.subject_type IS NULL OR ra.subject_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_recordings_subject_time
  ON recording_assets (subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recordings_status_time
  ON recording_assets (status, created_at DESC);

COMMIT;
