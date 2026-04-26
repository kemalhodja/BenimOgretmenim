-- BenimÖğretmenim — çekirdek PostgreSQL şeması (analitik odaklı)
-- PostgreSQL 13+ önerilir (gen_random_uuid).

BEGIN;

-- ---------------------------------------------------------------------------
-- Yardımcı tipler
-- ---------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');

CREATE TYPE lesson_package_status AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled',
  'dispute'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'held_in_escrow',
  'partially_released',
  'released_to_teacher',
  'refunded_to_student',
  'chargeback'
);

CREATE TYPE lesson_session_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled_by_student',
  'cancelled_by_teacher',
  'no_show_student',
  'no_show_teacher'
);

CREATE TYPE lesson_delivery_mode AS ENUM ('online', 'in_person', 'hybrid');

CREATE TYPE teacher_verification_status AS ENUM (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- Kimlik: kullanıcılar
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT GENERATED ALWAYS AS (lower(trim(email))) STORED,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'student',
  locale TEXT NOT NULL DEFAULT 'tr-TR',
  time_zone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT users_email_normalized_unique UNIQUE (email_normalized)
);

CREATE INDEX idx_users_role ON users (role);

-- ---------------------------------------------------------------------------
-- Coğrafya (filtre ve pazar analitiği)
-- ---------------------------------------------------------------------------
CREATE TABLE cities (
  id SMALLSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plate_code SMALLINT
);

CREATE TABLE districts (
  id SERIAL PRIMARY KEY,
  city_id SMALLINT NOT NULL REFERENCES cities (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE (city_id, slug)
);

-- ---------------------------------------------------------------------------
-- Branş / konu ağacı (metin yerine ID ile raporlama)
-- ---------------------------------------------------------------------------
CREATE TABLE branches (
  id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES branches (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_branches_parent ON branches (parent_id);

-- ---------------------------------------------------------------------------
-- Öğrenci profili
-- ---------------------------------------------------------------------------
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  city_id SMALLINT REFERENCES cities (id),
  district_id INT REFERENCES districts (id),
  -- Analitik: sınıf seviyesi ayrı kolon (metin değil)
  grade_level SMALLINT CHECK (grade_level IS NULL OR (grade_level >= 0 AND grade_level <= 14)),
  birth_year SMALLINT CHECK (birth_year IS NULL OR birth_year BETWEEN 1950 AND 2100),
  goals_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_city ON students (city_id);

-- ---------------------------------------------------------------------------
-- Öğretmen çekirdek profili ("Öğretme DNA"sı + yapılandırılmış alanlar)
-- ---------------------------------------------------------------------------
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  city_id SMALLINT REFERENCES cities (id),
  district_id INT REFERENCES districts (id),
  verification_status teacher_verification_status NOT NULL DEFAULT 'unverified',
  bio_raw TEXT,
  bio_ai_generated TEXT,
  video_url TEXT,
  -- Önbellek: yorumlardan periyodik güncellenir veya tetik ile
  rating_avg NUMERIC(3, 2) CHECK (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5)),
  rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  -- Genel ücret bandı (branş bazlı detay teacher_branches'ta)
  hourly_rate_range INT4RANGE,
  availability_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  teaching_style_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- AI / kurallar motoru çıktıları için ayrı şema (sürüm, güven skoru)
  teaching_style_model_version TEXT,
  teaching_style_confidence NUMERIC(4, 3) CHECK (
    teaching_style_confidence IS NULL
    OR (teaching_style_confidence >= 0 AND teaching_style_confidence <= 1)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_teachers_city ON teachers (city_id);
CREATE INDEX idx_teachers_rating ON teachers (rating_avg DESC NULLS LAST);
CREATE INDEX idx_teachers_verification ON teachers (verification_status);

CREATE INDEX idx_teachers_availability_gin ON teachers USING gin (availability_jsonb);
CREATE INDEX idx_teachers_style_gin ON teachers USING gin (teaching_style_jsonb);

-- Branş başına ücret ve deneyim → funnel / dönüşüm analitiği
CREATE TABLE teacher_branches (
  id BIGSERIAL PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  branch_id INT NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  years_experience SMALLINT CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80),
  hourly_rate_range INT4RANGE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, branch_id)
);

CREATE INDEX idx_teacher_branches_branch ON teacher_branches (branch_id);

-- ---------------------------------------------------------------------------
-- Ders paketi + ödeme (escrow durumu paket üzerinden; hareketler ayrı tabloda)
-- ---------------------------------------------------------------------------
CREATE TABLE lesson_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  total_lessons INT NOT NULL CHECK (total_lessons > 0),
  completed_lessons INT NOT NULL DEFAULT 0 CHECK (completed_lessons >= 0),
  status lesson_package_status NOT NULL DEFAULT 'draft',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  total_amount_minor INT NOT NULL CHECK (total_amount_minor >= 0),
  escrow_release_policy_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  dispute_opened_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_packages_completed_vs_total CHECK (completed_lessons <= total_lessons)
);

CREATE INDEX idx_lesson_packages_teacher ON lesson_packages (teacher_id);
CREATE INDEX idx_lesson_packages_student ON lesson_packages (student_id);
CREATE INDEX idx_lesson_packages_status_payment ON lesson_packages (status, payment_status);

-- Tekil ders oturumları — tamamlanma oranı, iptal, no-show analitiği
CREATE TABLE lesson_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES lesson_packages (id) ON DELETE CASCADE,
  session_index SMALLINT NOT NULL CHECK (session_index > 0),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration_minutes SMALLINT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  delivery_mode lesson_delivery_mode NOT NULL DEFAULT 'online',
  meeting_url TEXT,
  status lesson_session_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, session_index)
);

CREATE INDEX idx_lesson_sessions_package ON lesson_sessions (package_id);
CREATE INDEX idx_lesson_sessions_scheduled ON lesson_sessions (scheduled_start);

-- Yapılandırılmış geri bildirim (yıldız + boyutlar JSON veya ayrı kolonlar)
CREATE TABLE reviews (
  id BIGSERIAL PRIMARY KEY,
  lesson_session_id UUID NOT NULL REFERENCES lesson_sessions (id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  dimensions_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_session_id, reviewer_user_id)
);

CREATE INDEX idx_reviews_session ON reviews (lesson_session_id);

-- Escrow hareket defteri (denetim ve finansal analitik)
CREATE TABLE payment_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES lesson_packages (id) ON DELETE CASCADE,
  amount_minor INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  entry_type TEXT NOT NULL,
  external_ref TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_ledger_package ON payment_ledger_entries (package_id);
CREATE INDEX idx_payment_ledger_created ON payment_ledger_entries (created_at);

-- ---------------------------------------------------------------------------
-- Ürün analitiği: arama ve profil görüntüleme (kimliksiz session ile de)
-- ---------------------------------------------------------------------------
CREATE TABLE search_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  session_key TEXT,
  city_id SMALLINT REFERENCES cities (id),
  branch_ids INT[] NOT NULL DEFAULT '{}'::int[],
  filters_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  results_count INT,
  latency_ms INT
);

CREATE INDEX idx_search_events_time ON search_events (occurred_at DESC);
CREATE INDEX idx_search_events_branch_gin ON search_events USING gin (branch_ids);

CREATE TABLE profile_view_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewer_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  session_key TEXT,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  source TEXT,
  referrer TEXT
);

CREATE INDEX idx_profile_views_teacher_time ON profile_view_events (teacher_id, occurred_at DESC);

COMMIT;
