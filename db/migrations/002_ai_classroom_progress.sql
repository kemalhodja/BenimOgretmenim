-- BenimÖğretmenim — AI mülakat / müfredat, yerleşik sınıf kayıtları, ders sonu değerlendirme + veli bildirimi
-- Önkoşul: 001_core_schema.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Öğretmen kayıt: AI mülakat oturumu
-- ---------------------------------------------------------------------------
CREATE TYPE teacher_onboarding_status AS ENUM (
  'in_progress',
  'completed',
  'abandoned'
);

CREATE TYPE chat_message_role AS ENUM ('system', 'user', 'assistant');

CREATE TABLE teacher_onboarding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  status teacher_onboarding_status NOT NULL DEFAULT 'in_progress',
  locale TEXT NOT NULL DEFAULT 'tr-TR',
  ai_model TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_onboarding_teacher_time ON teacher_onboarding_sessions (teacher_id, started_at DESC);

CREATE TABLE onboarding_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES teacher_onboarding_sessions (id) ON DELETE CASCADE,
  seq INT NOT NULL CHECK (seq > 0),
  role chat_message_role NOT NULL,
  content TEXT NOT NULL,
  -- Araç çağrıları / yapılandırılmış çıkarım (analitik + denetim)
  tool_calls_jsonb JSONB,
  token_usage_jsonb JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, seq)
);

CREATE INDEX idx_onboarding_messages_session ON onboarding_messages (session_id);

-- ---------------------------------------------------------------------------
-- AI üretimi müfredat / eğitim programı (sürümlü, onay akışı)
-- ---------------------------------------------------------------------------
CREATE TYPE curriculum_plan_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE curriculum_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  source_onboarding_session_id UUID REFERENCES teacher_onboarding_sessions (id) ON DELETE SET NULL,
  version INT NOT NULL CHECK (version > 0),
  status curriculum_plan_status NOT NULL DEFAULT 'draft',
  -- Hedefler, konu sırası, önkoşullar, tahmini süre vb. (uygulama JSON şeması ile doğrulanır)
  plan_jsonb JSONB NOT NULL,
  ai_model TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, version)
);

CREATE UNIQUE INDEX uq_curriculum_one_draft_per_teacher ON curriculum_plans (teacher_id)
WHERE status = 'draft';

CREATE INDEX idx_curriculum_teacher_status ON curriculum_plans (teacher_id, status);

CREATE TABLE curriculum_plan_items (
  id BIGSERIAL PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES curriculum_plans (id) ON DELETE CASCADE,
  sort_order INT NOT NULL CHECK (sort_order >= 0),
  branch_id INT REFERENCES branches (id) ON DELETE SET NULL,
  topic_code TEXT,
  title TEXT NOT NULL,
  objectives_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_hours NUMERIC(6, 2) CHECK (estimated_hours IS NULL OR estimated_hours >= 0),
  prerequisites_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (plan_id, sort_order)
);

CREATE INDEX idx_curriculum_items_plan ON curriculum_plan_items (plan_id);
CREATE INDEX idx_curriculum_items_branch ON curriculum_plan_items (branch_id);

-- ---------------------------------------------------------------------------
-- Veli / vasi — öğrenci hesabına bağlı yetişkin (bildirim hedefi)
-- ---------------------------------------------------------------------------
CREATE TABLE student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  guardian_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  relationship TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, guardian_user_id)
);

CREATE INDEX idx_guardians_student ON student_guardians (student_id);
CREATE INDEX idx_guardians_user ON student_guardians (guardian_user_id);

-- ---------------------------------------------------------------------------
-- Yerleşik sanal sınıf oturumu + kayıt varlıkları
-- ---------------------------------------------------------------------------
CREATE TYPE classroom_session_status AS ENUM (
  'scheduled',
  'live',
  'ended',
  'failed'
);

CREATE TYPE recording_asset_status AS ENUM (
  'processing',
  'ready',
  'failed',
  'deleted'
);

CREATE TABLE classroom_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_session_id UUID NOT NULL UNIQUE REFERENCES lesson_sessions (id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'webrtc_internal',
  external_room_id TEXT,
  status classroom_session_status NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classroom_lesson ON classroom_sessions (lesson_session_id);

CREATE TABLE recording_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_session_id UUID NOT NULL REFERENCES classroom_sessions (id) ON DELETE CASCADE,
  status recording_asset_status NOT NULL DEFAULT 'processing',
  storage_bucket TEXT NOT NULL,
  storage_object_key TEXT NOT NULL,
  bytes BIGINT CHECK (bytes IS NULL OR bytes >= 0),
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  checksum_sha256 TEXT,
  -- KVKK / rıza: kayıt anındaki politika özeti ve onay id
  consent_snapshot_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (classroom_session_id, storage_object_key)
);

CREATE INDEX idx_recordings_classroom ON recording_assets (classroom_session_id);

-- ---------------------------------------------------------------------------
-- Ders sonu: öğretmen 3 soru + AI işlenmiş gelişim özeti
-- ---------------------------------------------------------------------------
CREATE TYPE ai_pipeline_status AS ENUM ('pending', 'completed', 'failed');

CREATE TABLE lesson_session_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_session_id UUID NOT NULL UNIQUE REFERENCES lesson_sessions (id) ON DELETE CASCADE,
  filled_by_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Örn: { "q1_mastery": 4, "q2_focus_topic": "türev", "q3_homework": "..." } — uygulama şeması ile sabitlenir
  answers_jsonb JSONB NOT NULL,
  ai_status ai_pipeline_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_session ON lesson_session_evaluations (lesson_session_id);

CREATE TABLE ai_progress_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL UNIQUE REFERENCES lesson_session_evaluations (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers (id) ON DELETE CASCADE,
  package_id UUID REFERENCES lesson_packages (id) ON DELETE SET NULL,
  -- Yapı: { "topics": [{"code":"derivative","mastery_estimate":0.8}], "next_focus":"integral" }
  metrics_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  narrative_tr TEXT NOT NULL,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_progress_snapshots_student_time ON ai_progress_snapshots (student_id, created_at DESC);
CREATE INDEX idx_progress_snapshots_teacher ON ai_progress_snapshots (teacher_id);

CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push');

CREATE TYPE notification_delivery_status AS ENUM (
  'queued',
  'sent',
  'read',
  'failed'
);

CREATE TABLE parent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  snapshot_id UUID REFERENCES ai_progress_snapshots (id) ON DELETE SET NULL,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_status notification_delivery_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parent_notif_recipient_time ON parent_notifications (recipient_user_id, created_at DESC);
CREATE INDEX idx_parent_notif_student ON parent_notifications (student_id);

COMMIT;
