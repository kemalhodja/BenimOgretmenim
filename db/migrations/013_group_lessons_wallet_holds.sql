-- Grup ders ilanı + cüzdan blokajı (hold) + 1 gün önce tahsilat için altyapı
-- Önkoşul: 011 (user_wallets)

BEGIN;

-- ---------------------------------------------------------------------------
-- Cüzdan blokajları: kullanılabilir bakiye = balance_minor - sum(active holds)
-- ---------------------------------------------------------------------------
CREATE TYPE wallet_hold_status AS ENUM ('active', 'released', 'charged');

CREATE TABLE user_wallet_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  status wallet_hold_status NOT NULL DEFAULT 'active',
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_holds_user_status ON user_wallet_holds (user_id, status, created_at DESC);
CREATE INDEX idx_wallet_holds_ref ON user_wallet_holds (ref_type, ref_id);

-- ---------------------------------------------------------------------------
-- Grup ders ilanı: toplam ücret 1000 TL; katılımcılar arasında paylaştırılır.
-- Katılımda ödeme alınmaz; share kadar hold açılır.
-- Planlanan dersten 1 gün önce tahsilat yapılır.
-- ---------------------------------------------------------------------------
CREATE TYPE group_lesson_request_status AS ENUM (
  'open',
  'teacher_assigned',
  'scheduled',
  'completed',
  'cancelled'
);

CREATE TABLE group_lesson_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_student_id UUID NOT NULL REFERENCES students (id) ON DELETE RESTRICT,
  branch_id INT NOT NULL REFERENCES branches (id) ON DELETE RESTRICT,
  topic_text TEXT NOT NULL,
  teacher_id UUID REFERENCES teachers (id) ON DELETE SET NULL,
  total_price_minor INT NOT NULL DEFAULT 100000 CHECK (total_price_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  planned_start TIMESTAMPTZ NOT NULL,
  status group_lesson_request_status NOT NULL DEFAULT 'open',
  -- Tahsilat işaretleri
  charged_at TIMESTAMPTZ,
  charged_total_minor INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_lessons_open ON group_lesson_requests (status, planned_start);
CREATE INDEX idx_group_lessons_teacher ON group_lesson_requests (teacher_id, status, planned_start);
CREATE INDEX idx_group_lessons_branch ON group_lesson_requests (branch_id, planned_start);

CREATE TABLE group_lesson_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES group_lesson_requests (id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  hold_id UUID NOT NULL REFERENCES user_wallet_holds (id) ON DELETE RESTRICT,
  hold_amount_minor BIGINT NOT NULL CHECK (hold_amount_minor > 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  charged_at TIMESTAMPTZ,
  charged_amount_minor BIGINT,
  UNIQUE (request_id, student_id)
);

CREATE INDEX idx_group_participants_request ON group_lesson_participants (request_id, joined_at);
CREATE INDEX idx_group_participants_student ON group_lesson_participants (student_id, joined_at DESC);

COMMIT;

