-- Rich assessment analysis fields for curriculum tests.

BEGIN;

ALTER TABLE student_curriculum_test_attempts
  ADD COLUMN IF NOT EXISTS mastery_level TEXT
    CHECK (mastery_level IS NULL OR mastery_level IN ('kritik', 'destek_gerekli', 'pekistirme', 'guclu')),
  ADD COLUMN IF NOT EXISTS misconceptions_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_actions_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS answered_count SMALLINT CHECK (answered_count IS NULL OR answered_count BETWEEN 0 AND 20);

CREATE INDEX IF NOT EXISTS idx_student_curriculum_test_attempts_mastery
  ON student_curriculum_test_attempts (student_id, mastery_level, created_at DESC);

UPDATE curriculum_test_questions
SET metadata_jsonb = jsonb_build_object(
    'skill', unit_title || ' kazanımını bağlam içinde uygulama',
    'misconception', 'Kazanımı bağlamdan koparıp ezber cevap vermek',
    'bloomLevel', CASE
      WHEN sort_order <= 5 THEN 'understand'
      WHEN sort_order <= 14 THEN 'apply'
      ELSE 'analyze'
    END,
    'estimatedSeconds', CASE
      WHEN sort_order <= 6 THEN 45
      WHEN sort_order <= 14 THEN 70
      ELSE 95
    END,
    'practiceHint', unit_title || ' için örnek çözüm incele, 8 hedefli soru çöz ve yanlışlarını not al.'
  ),
  updated_at = now()
WHERE metadata_jsonb = '{}'::jsonb
   OR metadata_jsonb ? 'skill' = false;

UPDATE student_curriculum_test_attempts
SET mastery_level = CASE
    WHEN correct_count < 10 THEN 'kritik'
    WHEN correct_count < 15 THEN 'destek_gerekli'
    WHEN correct_count < 18 THEN 'pekistirme'
    ELSE 'guclu'
  END,
  answered_count = coalesce(answered_count, question_count)
WHERE mastery_level IS NULL
   OR answered_count IS NULL;

COMMIT;
