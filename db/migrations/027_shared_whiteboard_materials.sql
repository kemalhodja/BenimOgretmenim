-- Shared classroom whiteboard state and lightweight material archive.

BEGIN;

CREATE TABLE IF NOT EXISTS classroom_whiteboard_states (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lesson_session', 'course_session')),
  subject_id UUID NOT NULL,
  updated_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  whiteboard_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_classroom_whiteboard_updated
  ON classroom_whiteboard_states (updated_at DESC);

CREATE TABLE IF NOT EXISTS classroom_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lesson_session', 'course_session')),
  subject_id UUID NOT NULL,
  uploaded_by_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 2),
  material_type TEXT NOT NULL DEFAULT 'link' CHECK (material_type IN ('link', 'image', 'pdf', 'video', 'note')),
  url TEXT,
  description TEXT,
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classroom_materials_subject_time
  ON classroom_materials (subject_type, subject_id, created_at DESC);

COMMIT;
