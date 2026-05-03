-- İlkokul / ortaokul branş ağacı + LGS görünen adı (idempotent).

BEGIN;

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT NULL, 'İlkokul', 'ilkokul', 3, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT NULL, 'Ortaokul', 'ortaokul', 4, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul');

-- İlkokul dersleri
INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Türkçe', 'ilkokul-turkce', 0, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-turkce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Matematik', 'ilkokul-matematik', 1, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-matematik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Hayat Bilgisi', 'ilkokul-hayat-bilgisi', 2, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-hayat-bilgisi');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Fen Bilimleri', 'ilkokul-fen-bilimleri', 3, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-fen-bilimleri');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'İngilizce', 'ilkokul-ingilizce', 4, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-ingilizce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Sosyal Bilgiler', 'ilkokul-sosyal-bilgiler', 5, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-sosyal-bilgiler');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Görsel Sanatlar', 'ilkokul-gorsel-sanatlar', 6, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-gorsel-sanatlar');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Müzik', 'ilkokul-muzik', 7, true
FROM branches b
WHERE b.slug = 'ilkokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ilkokul-muzik');

-- Ortaokul dersleri
INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Türkçe', 'ortaokul-turkce', 0, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-turkce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Matematik', 'ortaokul-matematik', 1, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-matematik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Fen Bilimleri', 'ortaokul-fen-bilimleri', 2, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-fen-bilimleri');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Sosyal Bilgiler', 'ortaokul-sosyal-bilgiler', 3, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-sosyal-bilgiler');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'İngilizce', 'ortaokul-ingilizce', 4, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-ingilizce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Din Kültürü ve Ahlak Bilgisi', 'ortaokul-dkab', 5, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-dkab');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Teknoloji ve Tasarım', 'ortaokul-teknoloji-tasarim', 6, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-teknoloji-tasarim');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Görsel Sanatlar', 'ortaokul-gorsel-sanatlar', 7, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-gorsel-sanatlar');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Müzik', 'ortaokul-muzik', 8, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-muzik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Beden Eğitimi ve Spor', 'ortaokul-beden-egitimi', 9, true
FROM branches b
WHERE b.slug = 'ortaokul'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ortaokul-beden-egitimi');

-- Mevcut sınav branşı: tam LGS ifadesi
UPDATE branches
SET name = 'LGS (Liselere Geçiş Sınavı)'
WHERE slug = 'lgs';

COMMIT;
