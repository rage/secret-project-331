CREATE TABLE user_email_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_email_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_email_codes_user ON user_email_codes(user_id, code)
WHERE deleted_at IS NULL
  AND used_at IS NULL;

COMMENT ON TABLE user_email_codes IS 'Stores single-use codes for actions like user account deletion verification.';
COMMENT ON COLUMN user_email_codes.id IS 'A unique identifier for this code record';
COMMENT ON COLUMN user_email_codes.code IS 'The single-use code sent to the user.';
COMMENT ON COLUMN user_email_codes.user_id IS 'References the user the code belongs to.';
COMMENT ON COLUMN user_email_codes.expires_at IS 'Time after which the code becomes invalid.';
COMMENT ON COLUMN user_email_codes.used_at IS 'Time when the code was used. Null if unused.';
COMMENT ON COLUMN user_email_codes.created_at IS 'Time when the code was created.';
COMMENT ON COLUMN user_email_codes.updated_at IS 'Time when the code was last updated. Automatically set by trigger.';
COMMENT ON COLUMN user_email_codes.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
