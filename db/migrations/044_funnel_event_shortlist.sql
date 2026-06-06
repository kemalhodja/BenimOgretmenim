-- Extend funnel events with shortlist interactions.

BEGIN;

ALTER TABLE funnel_events
  DROP CONSTRAINT IF EXISTS funnel_events_event_name_check;

ALTER TABLE funnel_events
  ADD CONSTRAINT funnel_events_event_name_check CHECK (event_name IN (
    'teacher_search',
    'teacher_profile_view',
    'teacher_shortlist',
    'demo_request_start',
    'lesson_request_created',
    'registration_completed',
    'payment_checkout_start',
    'campaign_application_created',
    'homework_post_created',
    'student_subscription_purchase_start'
  ));

COMMIT;
