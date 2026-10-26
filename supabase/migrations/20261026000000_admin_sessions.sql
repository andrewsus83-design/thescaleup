-- H2: server-side session revocation for code-based admin auth.
-- Each login creates a row; deleting a row (or all rows for an email) immediately
-- invalidates that session even though the cookie is still valid cryptographically.

CREATE TABLE IF NOT EXISTS admin_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_sessions_email_idx      ON admin_sessions(email);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions(expires_at);

-- RLS: service-role only (no anon/authenticated reads).
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON admin_sessions USING (false);
