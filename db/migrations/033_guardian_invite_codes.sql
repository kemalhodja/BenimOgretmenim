-- Controlled guardian invite codes for student-parent linking.

BEGIN;

CREATE TABLE IF NOT EXISTS guardian_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_guardian_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guardian_invites_student_time
  ON guardian_invite_codes (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guardian_invites_active
  ON guardian_invite_codes (expires_at)
  WHERE accepted_at IS NULL;

COMMIT;
