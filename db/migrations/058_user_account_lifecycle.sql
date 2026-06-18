-- Hesap askıya alma, silme talebi ve itiraz şeffaflığı (Tahta şikayetlerine karşı güven katmanı)

DO $$ BEGIN
  CREATE TYPE user_account_status AS ENUM ('active', 'suspended', 'deletion_requested');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status user_account_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by_admin_id UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status)
  WHERE account_status <> 'active';

COMMENT ON COLUMN users.account_status IS 'active | suspended | deletion_requested';
COMMENT ON COLUMN users.suspension_reason IS 'Kullanıcıya gösterilen askıya alma açıklaması';
