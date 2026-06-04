-- Applies the pending-review workflow after enum values are committed.

ALTER TABLE teacher_campaigns
  ALTER COLUMN status SET DEFAULT 'pending_review',
  ALTER COLUMN published_at DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_teacher_campaigns_moderation
  ON teacher_campaigns (status, created_at DESC);
