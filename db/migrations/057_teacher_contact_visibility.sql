-- Öğretmen profili: isteğe bağlı herkese açık iletişim bilgisi
-- Önkoşul: 001_core_schema.sql

BEGIN;

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS contact_public BOOLEAN NOT NULL DEFAULT false;

COMMIT;
