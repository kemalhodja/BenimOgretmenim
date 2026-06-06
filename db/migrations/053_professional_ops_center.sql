BEGIN;

ALTER TABLE teacher_wallet_withdrawals
  ADD COLUMN IF NOT EXISTS payout_provider TEXT NOT NULL DEFAULT 'manual_bank_transfer',
  ADD COLUMN IF NOT EXISTS payout_provider_ref TEXT,
  ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS export_batch_id TEXT;

CREATE TABLE IF NOT EXISTS platform_job_heartbeats (
  job_name TEXT PRIMARY KEY,
  expected_interval_minutes INT NOT NULL DEFAULT 10 CHECK (expected_interval_minutes > 0),
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'running', 'success', 'failed')),
  last_started_at TIMESTAMPTZ,
  last_finished_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  run_count INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_job_heartbeats_updated
  ON platform_job_heartbeats (updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN (
    'course_enrollment',
    'course_session',
    'direct_booking',
    'lesson_package',
    'homework_post',
    'wallet_transaction',
    'teacher_withdrawal',
    'other'
  )),
  subject_id TEXT,
  opened_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  opened_by_role TEXT,
  student_id UUID REFERENCES students (id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_user', 'waiting_admin', 'resolved', 'rejected')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_resolution TEXT,
  assigned_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_disputes_status_time
  ON platform_disputes (status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_disputes_actor
  ON platform_disputes (opened_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES platform_disputes (id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_dispute_messages_thread
  ON platform_dispute_messages (dispute_id, created_at ASC);

COMMIT;
