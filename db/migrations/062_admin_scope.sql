-- Admin erişim kapsamı: tam yetki, finans veya destek operasyonu

DO $$ BEGIN
  CREATE TYPE admin_scope AS ENUM ('full', 'finance', 'support');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_scope admin_scope NOT NULL DEFAULT 'full';

COMMENT ON COLUMN users.admin_scope IS 'Admin erişim kapsamı: full | finance | support';

UPDATE users SET admin_scope = 'full' WHERE role = 'admin'::user_role;
