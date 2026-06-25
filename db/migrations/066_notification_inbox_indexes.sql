-- In-app bildirim kutusu: okunmamış sayımı ve dedup sorguları için.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_user_notif_unread_recipient
  ON user_notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_parent_notif_unread_recipient
  ON parent_notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_notif_dedupe_kind
  ON user_notifications (recipient_user_id, (payload_jsonb->>'kind'), created_at DESC);

COMMIT;
