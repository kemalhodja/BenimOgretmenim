-- Idempotent reminder metadata for automated lesson notifications.

BEGIN;

ALTER TABLE parent_notifications
  ALTER COLUMN student_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS reminder_kind TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_notifications_dedupe_key
  ON parent_notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parent_notifications_reminder_time
  ON parent_notifications (reminder_kind, scheduled_for DESC)
  WHERE reminder_kind IS NOT NULL;

COMMIT;
