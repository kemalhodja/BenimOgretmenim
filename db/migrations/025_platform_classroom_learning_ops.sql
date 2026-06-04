-- Platform classroom, whiteboard notes, learning layer, and quality ops.

BEGIN;

CREATE TABLE IF NOT EXISTS classroom_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lesson_session', 'course_session')),
  subject_id UUID NOT NULL,
  author_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  body TEXT,
  whiteboard_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT classroom_note_has_content CHECK (
    coalesce(length(trim(body)), 0) > 0 OR whiteboard_jsonb <> '{}'::jsonb
  )
);

CREATE INDEX IF NOT EXISTS idx_classroom_notes_subject_time
  ON classroom_session_notes (subject_type, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_content_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  branch_slug TEXT,
  audience TEXT NOT NULL DEFAULT 'student',
  description TEXT,
  level_code TEXT,
  estimated_minutes INT CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES learning_content_modules (id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL CHECK (item_type IN ('video', 'pdf', 'quiz', 'practice', 'exam')),
  title TEXT NOT NULL,
  url TEXT,
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  payload_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_learning_content_modules_status
  ON learning_content_modules (status, created_at DESC);

CREATE TABLE IF NOT EXISTS student_study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  target_exam TEXT,
  weekly_minutes INT NOT NULL DEFAULT 300 CHECK (weekly_minutes > 0),
  weak_topics_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  generated_by TEXT NOT NULL DEFAULT 'rule_based',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_study_plans_student_time
  ON student_study_plans (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_study_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES student_study_plans (id) ON DELETE CASCADE,
  day_index SMALLINT NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  title TEXT NOT NULL,
  minutes INT NOT NULL CHECK (minutes > 0),
  module_id UUID REFERENCES learning_content_modules (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_study_plan_items_plan
  ON student_study_plan_items (plan_id, day_index);

CREATE TABLE IF NOT EXISTS student_assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  module_id UUID REFERENCES learning_content_modules (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  score_percent NUMERIC(5, 2) CHECK (score_percent IS NULL OR (score_percent >= 0 AND score_percent <= 100)),
  duration_minutes INT CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  weak_topics_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_assessment_attempts_student_time
  ON student_assessment_attempts (student_id, created_at DESC);

ALTER TABLE student_homework_posts
  ADD COLUMN IF NOT EXISTS answer_video_url TEXT,
  ADD COLUMN IF NOT EXISTS target_answer_minutes INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (quality_status IN ('not_reviewed', 'pending_review', 'accepted', 'revision_requested', 'flagged')),
  ADD COLUMN IF NOT EXISTS quality_score SMALLINT CHECK (quality_score IS NULL OR quality_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_quality_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderator_note TEXT,
  ADD COLUMN IF NOT EXISTS resolution_sla_due_at TIMESTAMPTZ;

ALTER TABLE support_threads
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS assigned_admin_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE direct_lesson_bookings
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'not_reviewed'
    CHECK (quality_status IN ('not_reviewed', 'pending_review', 'accepted', 'flagged'));

INSERT INTO learning_content_modules (slug, title, branch_slug, audience, description, level_code, estimated_minutes, metadata_jsonb)
VALUES
  ('lgs-matematik-problem-temelleri', 'LGS Matematik: Problem Temelleri', 'matematik', 'student',
   'Problem çözme rutinleri, oran-orantı ve işlem stratejileri için kısa çalışma paketi.', 'lgs', 90,
   '{"skills":["problem","oran-oranti","strateji"]}'::jsonb),
  ('yks-paragraf-hiz-kampi', 'YKS Paragraf: Hız ve Anlam Kampı', 'turkce', 'student',
   'Paragraf sorularında süre yönetimi ve ana düşünce yakalama çalışmaları.', 'yks', 75,
   '{"skills":["paragraf","anlam","sure"]}'::jsonb),
  ('tyt-fizik-temel-kavramlar', 'TYT Fizik: Temel Kavramlar', 'fizik', 'student',
   'Birimler, vektörler ve hareket giriş konularını toparlayan başlangıç modülü.', 'tyt', 80,
   '{"skills":["fizik","vektor","hareket"]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
