-- Veli hesabı (student_guardians.guardian_user_id)
-- Tek satır: schema_migrations ile yalnızca bir kez uygulanır.
-- Elle tekrar çalıştırmayın; enum'da 'guardian' zaten varsa hata verir.

ALTER TYPE user_role ADD VALUE 'guardian';
