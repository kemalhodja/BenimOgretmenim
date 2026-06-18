BEGIN;

ALTER TABLE direct_lesson_bookings
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_url TEXT;

CREATE INDEX IF NOT EXISTS idx_direct_bookings_scheduled
  ON direct_lesson_bookings (teacher_id, scheduled_start)
  WHERE scheduled_start IS NOT NULL AND status IN ('pending_funding', 'funded');

CREATE TABLE IF NOT EXISTS teacher_outcome_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  outcome_title TEXT NOT NULL,
  branch_slug TEXT,
  grade_level INT CHECK (grade_level IS NULL OR (grade_level >= 1 AND grade_level <= 12)),
  confidence SMALLINT NOT NULL DEFAULT 3 CHECK (confidence >= 1 AND confidence <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, outcome_title, branch_slug)
);

CREATE INDEX IF NOT EXISTS idx_teacher_outcome_tags_teacher
  ON teacher_outcome_tags (teacher_id, branch_slug);

CREATE TABLE IF NOT EXISTS sms_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  recipient_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  body_text TEXT NOT NULL,
  template_key TEXT,
  payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider TEXT,
  provider_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_status_created
  ON sms_outbox (status, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL
    CHECK (event_kind IN ('documents_uploaded', 'verification_requested', 'admin_verified', 'admin_rejected')),
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  note TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_verification_events_teacher
  ON teacher_verification_events (teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('direct_booking', 'lesson_request', 'general')),
  subject TEXT,
  student_id UUID REFERENCES students (id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
  direct_booking_id UUID REFERENCES direct_lesson_bookings (id) ON DELETE SET NULL,
  lesson_request_id UUID REFERENCES lesson_requests (id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_message_threads_direct_booking
  ON user_message_threads (direct_booking_id)
  WHERE direct_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_message_threads_student
  ON user_message_threads (student_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_user_message_threads_teacher
  ON user_message_threads (teacher_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS user_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES user_message_threads (id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_thread
  ON user_messages (thread_id, created_at ASC);

COMMIT;
