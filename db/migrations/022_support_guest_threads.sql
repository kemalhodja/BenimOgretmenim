BEGIN;

DROP INDEX IF EXISTS ux_support_threads_one_open_per_user;

ALTER TABLE support_threads
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN visitor_email TEXT,
  ADD COLUMN guest_token UUID;

ALTER TABLE support_threads
  ADD CONSTRAINT chk_support_thread_owner
  CHECK (
    (user_id IS NOT NULL AND visitor_email IS NULL AND guest_token IS NULL)
    OR
    (
      user_id IS NULL
      AND visitor_email IS NOT NULL
      AND guest_token IS NOT NULL
      AND char_length(btrim(visitor_email)) >= 5
    )
  );

CREATE UNIQUE INDEX ux_support_threads_one_open_logged_in
  ON support_threads (user_id)
  WHERE (status = 'open' AND user_id IS NOT NULL);

CREATE UNIQUE INDEX ux_support_threads_guest_open_email
  ON support_threads ((lower(btrim(visitor_email))))
  WHERE (status = 'open' AND user_id IS NULL);

CREATE UNIQUE INDEX ux_support_threads_guest_token
  ON support_threads (guest_token)
  WHERE (guest_token IS NOT NULL);

COMMIT;
