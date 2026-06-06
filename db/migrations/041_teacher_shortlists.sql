-- Account-based teacher shortlist/favorites for cross-device discovery.

BEGIN;

CREATE TABLE teacher_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'teacher_search',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, teacher_id)
);

CREATE INDEX idx_teacher_shortlists_user_time
  ON teacher_shortlists (user_id, created_at DESC);

CREATE INDEX idx_teacher_shortlists_teacher
  ON teacher_shortlists (teacher_id);

COMMIT;
