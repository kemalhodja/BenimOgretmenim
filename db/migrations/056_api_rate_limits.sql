-- Shared API rate-limit buckets for multi-instance production deployments.

BEGIN;

CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  limiter_name text NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_limiter_name
  ON api_rate_limit_buckets (limiter_name);

CREATE INDEX IF NOT EXISTS idx_api_rate_limit_buckets_reset_at
  ON api_rate_limit_buckets (reset_at);

COMMIT;
