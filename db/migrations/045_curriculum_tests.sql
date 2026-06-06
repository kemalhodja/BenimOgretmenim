-- Curriculum-aligned 20-question unit tests and student attempt history.

BEGIN;

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Felsefe', 'felsefe', 9, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'felsefe');

CREATE TABLE IF NOT EXISTS curriculum_test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  branch_slug TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  unit_title TEXT NOT NULL,
  outcome_code TEXT NOT NULL,
  outcome_title TEXT NOT NULL,
  question_text TEXT NOT NULL,
  choices_jsonb JSONB NOT NULL,
  correct_choice TEXT NOT NULL CHECK (correct_choice IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  sort_order INT NOT NULL CHECK (sort_order > 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grade_level, branch_slug, unit_slug, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_test_questions_catalog
  ON curriculum_test_questions (status, grade_level, branch_slug, unit_slug, sort_order);

CREATE TABLE IF NOT EXISTS student_curriculum_test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  branch_slug TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  unit_slug TEXT NOT NULL,
  unit_title TEXT NOT NULL,
  question_count SMALLINT NOT NULL DEFAULT 20 CHECK (question_count = 20),
  correct_count SMALLINT NOT NULL CHECK (correct_count BETWEEN 0 AND 20),
  score_percent NUMERIC(5, 2) NOT NULL CHECK (score_percent >= 0 AND score_percent <= 100),
  weak_outcomes_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_refs_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  teacher_support_recommended BOOLEAN NOT NULL DEFAULT false,
  teacher_recommendations_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_curriculum_test_attempts_student_time
  ON student_curriculum_test_attempts (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_curriculum_test_attempts_low_score
  ON student_curriculum_test_attempts (student_id, teacher_support_recommended, created_at DESC);

WITH templates(branch_slug, branch_name, grades, units) AS (
  VALUES
    ('ilkokul-turkce', 'Türkçe', ARRAY[1,2,3,4], ARRAY['Okuma Anlama','Dil Bilgisi','Yazma Becerisi']),
    ('ilkokul-matematik', 'Matematik', ARRAY[1,2,3,4], ARRAY['Sayılar ve İşlemler','Geometri','Veri Okuma']),
    ('ilkokul-hayat-bilgisi', 'Hayat Bilgisi', ARRAY[1,2,3], ARRAY['Okulumuzda Hayat','Evimizde Hayat','Sağlıklı Hayat']),
    ('ilkokul-fen-bilimleri', 'Fen Bilimleri', ARRAY[3,4], ARRAY['Canlılar Dünyası','Maddeyi Tanıyalım','Kuvvetin Etkileri']),
    ('ilkokul-sosyal-bilgiler', 'Sosyal Bilgiler', ARRAY[4], ARRAY['Birey ve Toplum','Kültür ve Miras','İnsanlar ve Yönetim']),
    ('ilkokul-ingilizce', 'İngilizce', ARRAY[2,3,4], ARRAY['Words and Greetings','Daily Life','Classroom Language']),
    ('ortaokul-turkce', 'Türkçe', ARRAY[5,6,7,8], ARRAY['Sözcükte Anlam','Cümlede Anlam','Paragraf ve Metin']),
    ('ortaokul-matematik', 'Matematik', ARRAY[5,6,7,8], ARRAY['Sayılar ve İşlemler','Cebirsel İfadeler','Geometri ve Ölçme']),
    ('ortaokul-fen-bilimleri', 'Fen Bilimleri', ARRAY[5,6,7,8], ARRAY['Canlılar ve Yaşam','Kuvvet ve Enerji','Madde ve Değişim']),
    ('ortaokul-sosyal-bilgiler', 'Sosyal Bilgiler', ARRAY[5,6,7], ARRAY['Birey ve Toplum','Kültür ve Miras','Üretim ve Dağıtım']),
    ('ortaokul-ingilizce', 'İngilizce', ARRAY[5,6,7,8], ARRAY['Vocabulary','Reading','Communication']),
    ('ortaokul-dkab', 'Din Kültürü ve Ahlak Bilgisi', ARRAY[5,6,7,8], ARRAY['İnanç','İbadet','Ahlak']),
    ('matematik', 'Matematik', ARRAY[9,10,11,12], ARRAY['Fonksiyonlar','Denklemler','Trigonometri','Türev ve İntegral']),
    ('edebiyat', 'Türk Dili ve Edebiyatı', ARRAY[9,10,11,12], ARRAY['Metin Türleri','Şiir Bilgisi','Roman ve Hikaye','Dil Bilgisi']),
    ('fizik', 'Fizik', ARRAY[9,10,11,12], ARRAY['Hareket ve Kuvvet','Enerji','Elektrik','Dalgalar']),
    ('kimya', 'Kimya', ARRAY[9,10,11,12], ARRAY['Atom ve Periyodik Sistem','Kimyasal Türler','Tepkimeler','Çözeltiler']),
    ('biyoloji', 'Biyoloji', ARRAY[9,10,11,12], ARRAY['Hücre','Canlıların Sınıflandırılması','Kalıtım','Ekosistem']),
    ('tarih', 'Tarih', ARRAY[9,10,11,12], ARRAY['Tarih Bilimi','İlk ve Orta Çağ','Osmanlı Tarihi','Cumhuriyet Tarihi']),
    ('cografya', 'Coğrafya', ARRAY[9,10,11,12], ARRAY['Doğal Sistemler','Beşeri Sistemler','Harita Bilgisi','Küresel Ortam']),
    ('ingilizce', 'İngilizce', ARRAY[9,10,11,12], ARRAY['Grammar','Reading','Vocabulary','Writing']),
    ('felsefe', 'Felsefe', ARRAY[10,11,12], ARRAY['Felsefeye Giriş','Bilgi Felsefesi','Ahlak Felsefesi'])
),
expanded AS (
  SELECT
    t.branch_slug,
    t.branch_name,
    grade_level,
    unit_title,
    unit_ordinal,
    regexp_replace(
      translate(lower(unit_title), 'ığüşöçİĞÜŞÖÇ', 'igusocigusoc'),
      '[^a-z0-9]+',
      '-',
      'g'
    ) AS unit_slug,
    sort_order,
    CASE ((sort_order + grade_level + unit_ordinal)::int % 4)
      WHEN 0 THEN 'A'
      WHEN 1 THEN 'B'
      WHEN 2 THEN 'C'
      ELSE 'D'
    END AS correct_choice
  FROM templates t
  CROSS JOIN unnest(t.grades) AS grade_level
  CROSS JOIN unnest(t.units) WITH ORDINALITY AS u(unit_title, unit_ordinal)
  CROSS JOIN generate_series(1, 20) AS sort_order
)
INSERT INTO curriculum_test_questions (
  grade_level, branch_slug, branch_name, unit_slug, unit_title,
  outcome_code, outcome_title, question_text, choices_jsonb,
  correct_choice, explanation, difficulty, sort_order
)
SELECT
  grade_level,
  branch_slug,
  branch_name,
  trim(both '-' from unit_slug),
  unit_title,
  grade_level || '.' || branch_slug || '.' || unit_ordinal || '.' || sort_order,
  unit_title || ' kazanımını günlük problem durumunda uygular',
  grade_level || '. sınıf ' || branch_name || ' dersi "' || unit_title || '" ünitesi için ' || sort_order || '. kazanım sorusu: Öğrenci verilen durumda hangi yaklaşımı seçerse kazanımı doğru uygulamış olur?',
  jsonb_build_array(
    jsonb_build_object('key', 'A', 'text', CASE WHEN correct_choice = 'A' THEN grade_level || '. sınıf düzeyinde ' || unit_title || ' kazanımını gerekçeli ve işlem adımlarıyla uygular.' ELSE 'Yalnızca tanımı ezberler, örnek durumla ilişki kurmaz.' END),
    jsonb_build_object('key', 'B', 'text', CASE WHEN correct_choice = 'B' THEN grade_level || '. sınıf düzeyinde ' || unit_title || ' kazanımını gerekçeli ve işlem adımlarıyla uygular.' ELSE 'Sorunun verdiği bilgileri kullanmadan genel bir tahmin yapar.' END),
    jsonb_build_object('key', 'C', 'text', CASE WHEN correct_choice = 'C' THEN grade_level || '. sınıf düzeyinde ' || unit_title || ' kazanımını gerekçeli ve işlem adımlarıyla uygular.' ELSE 'Kazanımı başka bir üniteyle karıştırarak eksik sonuca ulaşır.' END),
    jsonb_build_object('key', 'D', 'text', CASE WHEN correct_choice = 'D' THEN grade_level || '. sınıf düzeyinde ' || unit_title || ' kazanımını gerekçeli ve işlem adımlarıyla uygular.' ELSE 'Sonuca ulaşmadan yalnızca ilk bilgiyi tekrar eder.' END)
  ),
  correct_choice,
  'Doğru cevap, kazanımı ezber yerine verilen durumla ilişkilendirip gerekçelendiren seçenektir.',
  CASE WHEN sort_order <= 6 THEN 'easy' WHEN sort_order <= 14 THEN 'medium' ELSE 'hard' END,
  sort_order
FROM expanded
ON CONFLICT (grade_level, branch_slug, unit_slug, sort_order) DO NOTHING;

COMMIT;
