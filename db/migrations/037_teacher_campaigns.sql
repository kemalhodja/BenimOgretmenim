-- Teacher-created campaign advertisements and student applications.

BEGIN;

CREATE TYPE teacher_campaign_status AS ENUM ('pending_review', 'published', 'paused', 'archived', 'rejected');
CREATE TYPE teacher_campaign_application_status AS ENUM ('new', 'contacted', 'closed');

CREATE TABLE teacher_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  branch_id INT REFERENCES branches (id) ON DELETE SET NULL,
  city_id SMALLINT REFERENCES cities (id) ON DELETE SET NULL,
  district_id INT REFERENCES districts (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 3),
  description TEXT NOT NULL CHECK (length(trim(description)) >= 20),
  delivery_mode lesson_delivery_mode NOT NULL DEFAULT 'online',
  lesson_count INT CHECK (lesson_count IS NULL OR lesson_count > 0),
  price_minor INT NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  capacity INT CHECK (capacity IS NULL OR capacity > 0),
  starts_at TIMESTAMPTZ,
  status teacher_campaign_status NOT NULL DEFAULT 'pending_review',
  listing_fee_minor INT NOT NULL DEFAULT 0 CHECK (listing_fee_minor >= 0),
  listing_fee_currency CHAR(3) NOT NULL DEFAULT 'TRY',
  free_listing_used BOOLEAN NOT NULL DEFAULT false,
  reviewed_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_campaigns_public
  ON teacher_campaigns (status, created_at DESC);
CREATE INDEX idx_teacher_campaigns_teacher
  ON teacher_campaigns (teacher_id, created_at DESC);
CREATE INDEX idx_teacher_campaigns_branch
  ON teacher_campaigns (branch_id);
CREATE INDEX idx_teacher_campaigns_city
  ON teacher_campaigns (city_id);

CREATE TABLE teacher_campaign_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES teacher_campaigns (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  message TEXT CHECK (message IS NULL OR length(trim(message)) <= 2000),
  status teacher_campaign_application_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, student_id)
);

CREATE INDEX idx_teacher_campaign_apps_campaign
  ON teacher_campaign_applications (campaign_id, created_at DESC);
CREATE INDEX idx_teacher_campaign_apps_student
  ON teacher_campaign_applications (student_id, created_at DESC);

COMMIT;
