-- Ders paketinin hangi talep türünden oluştuğunu saklar.

BEGIN;

ALTER TABLE lesson_packages
  ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES lesson_requests (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_kind TEXT NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  ALTER TABLE lesson_packages
    ADD CONSTRAINT lesson_packages_request_kind_check
    CHECK (request_kind IN ('regular', 'demo'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_lesson_packages_source_request
  ON lesson_packages (source_request_id);

COMMIT;
