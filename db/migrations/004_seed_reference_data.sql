-- Idempotent referans veri: şehir, ilçe, branş ağacı (analitik / filtre için)

BEGIN;

INSERT INTO cities (name, slug, plate_code)
SELECT 'İstanbul', 'istanbul', 34
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE slug = 'istanbul');

INSERT INTO cities (name, slug, plate_code)
SELECT 'Ankara', 'ankara', 6
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE slug = 'ankara');

INSERT INTO cities (name, slug, plate_code)
SELECT 'İzmir', 'izmir', 35
WHERE NOT EXISTS (SELECT 1 FROM cities WHERE slug = 'izmir');

INSERT INTO districts (city_id, name, slug)
SELECT c.id, 'Kadıköy', 'kadikoy'
FROM cities c
WHERE c.slug = 'istanbul'
  AND NOT EXISTS (
    SELECT 1 FROM districts d WHERE d.city_id = c.id AND d.slug = 'kadikoy'
  );

INSERT INTO districts (city_id, name, slug)
SELECT c.id, 'Beşiktaş', 'besiktas'
FROM cities c
WHERE c.slug = 'istanbul'
  AND NOT EXISTS (
    SELECT 1 FROM districts d WHERE d.city_id = c.id AND d.slug = 'besiktas'
  );

INSERT INTO districts (city_id, name, slug)
SELECT c.id, 'Çankaya', 'cankaya'
FROM cities c
WHERE c.slug = 'ankara'
  AND NOT EXISTS (
    SELECT 1 FROM districts d WHERE d.city_id = c.id AND d.slug = 'cankaya'
  );

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT NULL, 'Akademik', 'akademik', 0, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'akademik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT NULL, 'Yabancı dil', 'yabanci-dil', 1, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'yabanci-dil');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT NULL, 'Sınav hazırlık', 'sinav-hazirlik', 2, true
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'sinav-hazirlik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Matematik', 'matematik', 0, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'matematik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Fizik', 'fizik', 1, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'fizik');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'Kimya', 'kimya', 2, true
FROM branches b
WHERE b.slug = 'akademik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'kimya');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'İngilizce', 'ingilizce', 0, true
FROM branches b
WHERE b.slug = 'yabanci-dil'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'ingilizce');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'LGS', 'lgs', 0, true
FROM branches b
WHERE b.slug = 'sinav-hazirlik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'lgs');

INSERT INTO branches (parent_id, name, slug, sort_order, is_active)
SELECT b.id, 'YKS', 'yks', 1, true
FROM branches b
WHERE b.slug = 'sinav-hazirlik'
  AND NOT EXISTS (SELECT 1 FROM branches WHERE slug = 'yks');

COMMIT;
