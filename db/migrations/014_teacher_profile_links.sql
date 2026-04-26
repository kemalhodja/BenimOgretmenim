-- Öğretmen profili: sosyal + platform + doküman linkleri
-- Önkoşul: 001_core_schema.sql

BEGIN;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS platform_links_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exam_docs_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

