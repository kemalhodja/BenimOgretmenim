-- Learning metadata for Tahta-style question solving.

BEGIN;

ALTER TABLE student_homework_posts
  ADD COLUMN IF NOT EXISTS grade_level_text TEXT,
  ADD COLUMN IF NOT EXISTS target_exam TEXT,
  ADD COLUMN IF NOT EXISTS learning_objective TEXT,
  ADD COLUMN IF NOT EXISTS urgency_level TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency_level IN ('normal', 'priority', 'urgent'));

CREATE INDEX IF NOT EXISTS idx_homework_posts_urgency_sla
  ON student_homework_posts (urgency_level, resolution_sla_due_at ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_homework_posts_exam
  ON student_homework_posts (target_exam)
  WHERE target_exam IS NOT NULL;

COMMIT;
