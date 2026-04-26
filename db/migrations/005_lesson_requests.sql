-- Ders talebi akışı: öğrenci talep açar → öğretmen teklif verir → kabul ile paketleşmeye hazırlanır
-- Önkoşul: 001_core_schema.sql

BEGIN;

CREATE TYPE lesson_request_status AS ENUM (
  'open',
  'matched',
  'cancelled',
  'expired'
);

CREATE TYPE lesson_offer_status AS ENUM (
  'sent',
  'accepted',
  'rejected',
  'withdrawn'
);

CREATE TABLE lesson_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  branch_id INT NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  city_id SMALLINT REFERENCES cities (id),
  district_id INT REFERENCES districts (id),
  delivery_mode lesson_delivery_mode NOT NULL DEFAULT 'online',
  budget_hourly_range INT4RANGE,
  availability_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  status lesson_request_status NOT NULL DEFAULT 'open',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_requests_status_created ON lesson_requests (status, created_at DESC);
CREATE INDEX idx_lesson_requests_branch ON lesson_requests (branch_id);
CREATE INDEX idx_lesson_requests_city ON lesson_requests (city_id);

CREATE TABLE lesson_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES lesson_requests (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
  message TEXT,
  proposed_hourly_rate_minor INT CHECK (proposed_hourly_rate_minor IS NULL OR proposed_hourly_rate_minor >= 0),
  status lesson_offer_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, teacher_id)
);

CREATE INDEX idx_lesson_offers_request ON lesson_offers (request_id, created_at DESC);
CREATE INDEX idx_lesson_offers_teacher ON lesson_offers (teacher_id, created_at DESC);

-- Basit mesajlaşma (talep bazında); canlı chat yerine MVP
CREATE TYPE request_message_role AS ENUM ('student', 'teacher', 'system');

CREATE TABLE lesson_request_messages (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES lesson_requests (id) ON DELETE CASCADE,
  offer_id UUID REFERENCES lesson_offers (id) ON DELETE SET NULL,
  role request_message_role NOT NULL,
  sender_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_messages_request_time ON lesson_request_messages (request_id, created_at ASC);

COMMIT;

