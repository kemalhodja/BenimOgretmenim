-- Records production smoke results so admin health can surface deploy verification.

BEGIN;

CREATE TABLE operational_smoke_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'github_actions',
  status TEXT NOT NULL CHECK (status IN ('ok', 'failed')),
  target_url TEXT,
  workflow TEXT,
  run_id TEXT,
  commit_sha TEXT,
  details_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operational_smoke_runs_time
  ON operational_smoke_runs (created_at DESC);

CREATE INDEX idx_operational_smoke_runs_status_time
  ON operational_smoke_runs (status, created_at DESC);

COMMIT;
