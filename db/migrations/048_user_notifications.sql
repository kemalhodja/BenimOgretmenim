BEGIN;

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_status notification_delivery_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_recipient_time
  ON user_notifications (recipient_user_id, created_at DESC);

COMMIT;
