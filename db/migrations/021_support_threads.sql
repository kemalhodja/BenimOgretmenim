BEGIN;

CREATE TABLE support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  context_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_support_threads_one_open_per_user
  ON support_threads (user_id)
  WHERE (status = 'open');

CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES support_threads (id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'staff')),
  body TEXT NOT NULL CHECK (char_length(trim(body)) >= 1 AND char_length(body) <= 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_thread_time ON support_messages (thread_id, created_at ASC);

COMMIT;
