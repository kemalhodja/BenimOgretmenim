-- Make PayTR reconciliation events operationally closable.

BEGIN;

ALTER TABLE payment_reconciliation_events
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'resolved', 'dismissed')),
  ADD COLUMN IF NOT EXISTS resolution_kind TEXT
    CHECK (
      resolution_kind IS NULL OR resolution_kind IN (
        'provider_retry',
        'manual_adjustment',
        'manual_refund',
        'duplicate',
        'not_actionable',
        'other'
      )
    ),
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE payment_reconciliation_events
SET resolution_status = 'resolved',
    resolution_kind = 'not_actionable',
    resolution_note = coalesce(resolution_note, 'Matched callback; no manual action required.'),
    resolved_at = coalesce(resolved_at, created_at),
    updated_at = now()
WHERE status = 'matched'
  AND resolution_status = 'open';

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_resolution
  ON payment_reconciliation_events (resolution_status, created_at DESC);

COMMIT;
