-- AI/OCR metadata and answer quality signals for question solving.

BEGIN;

ALTER TABLE student_homework_posts
  ADD COLUMN IF NOT EXISTS ai_metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS storage_backend TEXT NOT NULL DEFAULT 'inline_data_url',
  ADD COLUMN IF NOT EXISTS answer_quality_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_homework_posts_ai_metadata_gin
  ON student_homework_posts USING gin (ai_metadata_jsonb);

CREATE INDEX IF NOT EXISTS idx_homework_posts_quality_score
  ON student_homework_posts (quality_score DESC NULLS LAST)
  WHERE quality_score IS NOT NULL;

COMMIT;
