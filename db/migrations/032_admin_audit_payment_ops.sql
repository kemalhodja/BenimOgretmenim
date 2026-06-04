-- Admin audit trail and payment reconciliation events.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_role TEXT,
  request_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT,
  before_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_time
  ON admin_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_entity
  ON admin_audit_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor
  ON admin_audit_events (actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_reconciliation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'paytr',
  merchant_oid TEXT NOT NULL,
  payment_table TEXT,
  payment_id UUID,
  expected_amount_minor INT,
  received_amount_minor INT,
  status TEXT NOT NULL CHECK (status IN ('matched', 'amount_mismatch', 'unknown_merchant_oid', 'failed')),
  details_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_time
  ON payment_reconciliation_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_oid
  ON payment_reconciliation_events (merchant_oid, created_at DESC);

COMMIT;
