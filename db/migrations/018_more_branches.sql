-- Daha fazla branş (idempotent).
-- Not: Bu migration yalnızca referans veri ekler; mevcut kayıtları değiştirmez.

BEGIN;

-- Akademik (akademik) alt branşlar
INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Türkçe', 'turkce', 3, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'turkce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Edebiyat', 'edebiyat', 4, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'edebiyat');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Biyoloji', 'biyoloji', 5, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'biyoloji');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Tarih', 'tarih', 6, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'tarih');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Coğrafya', 'cografya', 7, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'cografya');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Geometri', 'geometri', 8, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'geometri');

-- Yabancı dil (yabanci-dil) alt branşlar
INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Almanca', 'almanca', 1, true
FROM branches b
WHERE b.slug = 'yabanci-dil'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'almanca');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Fransızca', 'fransizca', 2, true
FROM branches b
WHERE b.slug = 'yabanci-dil'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'fransizca');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Arapça', 'arapca', 3, true
FROM branches b
WHERE b.slug = 'yabanci-dil'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'arapca');

-- Sınav hazırlık (sinav-hazirlik) alt branşlar
INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'KPSS', 'kpss', 2, true
FROM branches b
WHERE b.slug = 'sinav-hazirlik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'kpss');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'ALES', 'ales', 3, true
FROM branches b
WHERE b.slug = 'sinav-hazirlik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ales');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'YDS', 'yds', 4, true
FROM branches b
WHERE b.slug = 'sinav-hazirlik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'yds');

COMMIT;

