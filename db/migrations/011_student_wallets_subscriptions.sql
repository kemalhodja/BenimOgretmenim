-- Öğrenci cüzdanı, platform aboneliği (soru/ilan için), branş havuzuna ödev sorusu
-- Önkoşul: 001 (users), 007 (payment_method, payment_state - course ödemesinde), 005 lesson_requests

BEGIN;

-- Cüzdan: kullanıcı başına tek bakiye (kuruş)
CREATE TABLE user_wallets (
  user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  balance_minor BIGINT NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_wallets_non_negative CHECK (balance_minor >= 0)
);

CREATE TABLE user_wallet_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  delta_minor BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  kind TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_ledger_user_time ON user_wallet_ledger (user_id, created_at DESC);

-- Öğrenci platform aboneliği (soru/ilan) — 1000 TL/ay × ay; ödeme student_sub_payments üzerinden
CREATE TYPE student_sub_lifecycle AS ENUM ('awaiting_payment', 'active', 'expired', 'cancelled');

CREATE TABLE student_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  months_count SMALLINT NOT NULL CHECK (months_count >= 1 AND months_count <= 60),
  price_per_month_minor INT NOT NULL DEFAULT 100000,
  price_total_minor INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  lifecycle student_sub_lifecycle NOT NULL DEFAULT 'awaiting_payment',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_subs_user_time ON student_subscriptions (user_id, created_at DESC);
CREATE INDEX idx_student_subs_active ON student_subscriptions (user_id, expires_at)
  WHERE lifecycle = 'active';

-- PayTR ödeme satırı
CREATE TABLE student_sub_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES student_subscriptions (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_minor INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  method payment_method NOT NULL DEFAULT 'paytr_iframe',
  state payment_state NOT NULL DEFAULT 'pending',
  merchant_oid TEXT UNIQUE,
  paytr_iframe_token TEXT,
  paytr_status TEXT,
  paytr_total_amount_minor INT,
  paytr_raw_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_sub_payments_merchant ON student_sub_payments (merchant_oid);

-- Ders ilanı: konu + medya (foto / ses) — 005 e ek
ALTER TABLE lesson_requests
  ADD COLUMN IF NOT EXISTS topic_text TEXT,
  ADD COLUMN IF NOT EXISTS image_urls_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Branş havuzundaki “soru/ödev yardım” gönderileri
CREATE TYPE homework_post_status AS ENUM (
  'open',
  'claimed',
  'answered',
  'closed',
  'cancelled'
);

CREATE TABLE student_homework_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  branch_id INT NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  topic TEXT NOT NULL,
  help_text TEXT NOT NULL,
  image_urls_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_url TEXT,
  status homework_post_status NOT NULL DEFAULT 'open',
  claimed_by_teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_homework_posts_branch_status ON student_homework_posts (branch_id, status, created_at DESC);
CREATE INDEX idx_homework_posts_student ON student_homework_posts (student_id, created_at DESC);

-- Doğrudan ders: öğrenci–öğretmen anlaşma tutarı havuzda; oturum bitiminde serbest
CREATE TYPE direct_booking_status AS ENUM (
  'pending_funding',
  'funded',
  'completed',
  'disputed',
  'cancelled'
);

CREATE TABLE direct_lesson_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
  agreed_amount_minor INT NOT NULL CHECK (agreed_amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  status direct_booking_status NOT NULL DEFAULT 'pending_funding',
  paytr_merchant_oid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_direct_bookings_teacher ON direct_lesson_bookings (teacher_id, status);
CREATE INDEX idx_direct_bookings_student ON direct_lesson_bookings (student_id, created_at DESC);

COMMIT;
