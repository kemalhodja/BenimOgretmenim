-- Ödev/soru havuzu: cevap, süre dolunca havuza dönüş, öğrenci onayı + öğretmen ödülü

ALTER TABLE student_homework_posts
  ADD COLUMN IF NOT EXISTS resolve_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answer_text TEXT,
  ADD COLUMN IF NOT EXISTS answer_image_urls_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_satisfied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS homework_reward_minor INT,
  ADD COLUMN IF NOT EXISTS homework_reward_applied_at TIMESTAMPTZ;

COMMENT ON COLUMN student_homework_posts.resolve_deadline_at IS 'Üstlenme sonrası cevap için son tarih (varsayılan 20 dk); geçince kayıt tekrar open olur.';
