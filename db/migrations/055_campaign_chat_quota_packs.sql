-- Campaign chat and over-quota usage credit packs.

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_campaign_application_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES teacher_campaign_applications (id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'teacher')),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_campaign_app_messages_thread
  ON teacher_campaign_application_messages (application_id, created_at ASC);

CREATE TABLE IF NOT EXISTS teacher_campaign_conversation_usage (
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  base_quota INT NOT NULL DEFAULT 10 CHECK (base_quota >= 0),
  opened_count INT NOT NULL DEFAULT 0 CHECK (opened_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, period_start)
);

CREATE TABLE IF NOT EXISTS usage_credit_packs (
  code TEXT PRIMARY KEY,
  audience_role TEXT NOT NULL CHECK (audience_role IN ('student', 'teacher')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_minor INT NOT NULL CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  credits_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  pack_code TEXT NOT NULL REFERENCES usage_credit_packs (code) ON DELETE RESTRICT,
  amount_minor INT NOT NULL CHECK (amount_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  method TEXT NOT NULL DEFAULT 'wallet' CHECK (method IN ('wallet')),
  state TEXT NOT NULL DEFAULT 'paid' CHECK (state IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_credit_payments_user_time
  ON usage_credit_payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_usage_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  pack_code TEXT NOT NULL REFERENCES usage_credit_packs (code) ON DELETE RESTRICT,
  payment_id UUID REFERENCES usage_credit_payments (id) ON DELETE SET NULL,
  credit_type TEXT NOT NULL CHECK (
    credit_type IN ('student_homework', 'student_lesson_request', 'teacher_campaign_conversation')
  ),
  quantity INT NOT NULL CHECK (quantity > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_usage_credits_used_lte_quantity CHECK (used_count <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_credits_available
  ON user_usage_credits (user_id, credit_type, valid_until, created_at)
  WHERE used_count < quantity;

INSERT INTO usage_credit_packs (code, audience_role, title, description, price_minor, currency, credits_jsonb, sort_order)
VALUES
  (
    'student_combo_day_129',
    'student',
    'Günlük ek ders ve soru paketi',
    'Aynı gün için +3 ders talebi ve +10 soru hakkı.',
    12900,
    'TRY',
    '[{"type":"student_lesson_request","quantity":3,"validDays":1},{"type":"student_homework","quantity":10,"validDays":1}]'::jsonb,
    10
  ),
  (
    'student_homework_day_79',
    'student',
    'Günlük ek soru paketi',
    'Aynı gün için +10 soru hakkı.',
    7900,
    'TRY',
    '[{"type":"student_homework","quantity":10,"validDays":1}]'::jsonb,
    20
  ),
  (
    'student_lesson_request_day_59',
    'student',
    'Günlük ek ders talebi paketi',
    'Aynı gün için +3 ders talebi hakkı.',
    5900,
    'TRY',
    '[{"type":"student_lesson_request","quantity":3,"validDays":1}]'::jsonb,
    30
  ),
  (
    'teacher_campaign_chat_250',
    'teacher',
    'Komisyonlu kampanya ek görüşme paketi',
    'Komisyonlu kampanyalar için +10 yeni öğrenci sohbeti.',
    25000,
    'TRY',
    '[{"type":"teacher_campaign_conversation","quantity":10}]'::jsonb,
    40
  )
ON CONFLICT (code) DO UPDATE
SET title = excluded.title,
    description = excluded.description,
    price_minor = excluded.price_minor,
    currency = excluded.currency,
    credits_jsonb = excluded.credits_jsonb,
    audience_role = excluded.audience_role,
    is_active = true,
    sort_order = excluded.sort_order;

COMMIT;
