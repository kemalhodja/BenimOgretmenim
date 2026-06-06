-- Product funnel observability for search, profile, request, payment and learning actions.

BEGIN;

CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'teacher_search',
    'teacher_profile_view',
    'demo_request_start',
    'lesson_request_created',
    'registration_completed',
    'payment_checkout_start',
    'campaign_application_created',
    'homework_post_created',
    'student_subscription_purchase_start'
  )),
  entity_type TEXT,
  entity_id TEXT,
  request_id TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_funnel_events_name_time
  ON funnel_events (event_name, created_at DESC);

CREATE INDEX idx_funnel_events_user_time
  ON funnel_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

COMMIT;
