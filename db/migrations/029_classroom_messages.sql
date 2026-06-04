-- Persistent in-class chat and question stream.

BEGIN;

CREATE TABLE IF NOT EXISTS classroom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lesson_session', 'course_session')),
  subject_id UUID NOT NULL,
  author_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  author_role TEXT,
  author_display_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'answer', 'announcement')),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_classroom_messages_subject_time
  ON classroom_messages (subject_type, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_classroom_messages_type_time
  ON classroom_messages (message_type, created_at DESC);

COMMIT;
