CREATE TABLE pending_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL CHECK (email LIKE '%@%'),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country TEXT NOT NULL,
  language TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_communication_consent BOOLEAN NOT NULL,
  code_digest BYTEA NOT NULL CHECK (length(code_digest) = 32),
  code_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  email_delivery_id UUID REFERENCES email_deliveries(id),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pending_signups_email ON pending_signups (lower(email));
CREATE INDEX pending_signups_expires_at ON pending_signups (expires_at);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON pending_signups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE pending_signups IS 'Signups waiting for the code mailed to the address. No account exists until the code is typed; then the account is created from the row and the row is hard-deleted. A new signup with the same address replaces the row, and expired rows are hard-deleted.';
COMMENT ON COLUMN pending_signups.email IS 'The address the signup is for.';
COMMENT ON COLUMN pending_signups.first_name IS 'The first name typed on the form.';
COMMENT ON COLUMN pending_signups.last_name IS 'The last name typed on the form.';
COMMENT ON COLUMN pending_signups.country IS 'The country picked on the form.';
COMMENT ON COLUMN pending_signups.language IS 'The language the form was used in.';
COMMENT ON COLUMN pending_signups.password_hash IS 'Hash of the chosen password, in the format of user_passwords.password_hash.';
COMMENT ON COLUMN pending_signups.email_communication_consent IS 'Whether the form asked for marketing mail; recorded on the account once it exists.';
COMMENT ON COLUMN pending_signups.code_digest IS 'SHA-256 of the code mailed to the address.';
COMMENT ON COLUMN pending_signups.code_sent_at IS 'When the current code was queued for mailing.';
COMMENT ON COLUMN pending_signups.email_delivery_id IS 'The mail carrying the current code. Its copy of the code is erased when the row goes.';
COMMENT ON COLUMN pending_signups.failed_attempts IS 'Wrong codes typed for the row. The row is deleted when they reach the limit.';
COMMENT ON COLUMN pending_signups.expires_at IS 'When the signup lapses.';
COMMENT ON COLUMN pending_signups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN pending_signups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
