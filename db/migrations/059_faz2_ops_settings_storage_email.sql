BEGIN;

CREATE TABLE IF NOT EXISTS platform_ops_settings (
  key TEXT PRIMARY KEY,
  value_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_ops_settings (key, value_jsonb)
VALUES (
  'teacher_auto_withdrawal',
  '{
    "enabled": true,
    "autoApproveEnabled": false,
    "maxAmountMinor": 250000,
    "requireVerified": true,
    "requireSameIbanAsLastPaid": true,
    "minPriorPaidCount": 1,
    "maxDailyAutoApprovals": 3
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_ops_settings (key, value_jsonb)
VALUES (
  'support_sla',
  '{
    "firstResponseHours": 24,
    "disputeFirstResponseHours": 24
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
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

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_created
  ON email_outbox (status, created_at DESC);

CREATE TABLE IF NOT EXISTS guardian_email_preferences (
  guardian_user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  homework_enabled BOOLEAN NOT NULL DEFAULT true,
  lesson_enabled BOOLEAN NOT NULL DEFAULT true,
  payment_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homework_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  homework_post_id UUID,
  storage_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INT NOT NULL CHECK (byte_size > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_media_assets_post
  ON homework_media_assets (homework_post_id, created_at DESC);

COMMIT;
