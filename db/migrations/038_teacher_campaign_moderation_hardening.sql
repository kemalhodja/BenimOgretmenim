-- Adds moderation enum values for environments where migration 037 may already
-- have been applied before the pending-review workflow.

ALTER TYPE teacher_campaign_status ADD VALUE IF NOT EXISTS 'pending_review' BEFORE 'published';
ALTER TYPE teacher_campaign_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'archived';
