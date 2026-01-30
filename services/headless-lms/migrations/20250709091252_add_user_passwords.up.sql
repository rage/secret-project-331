CREATE TABLE user_passwords (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_passwords FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE user_passwords IS 'This table is used to keep a record of the users password';
COMMENT ON COLUMN user_passwords.user_id IS 'References the unique identifier of the user.';
COMMENT ON COLUMN user_passwords.password_hash IS 'Hashed password of the user';
;
COMMENT ON COLUMN user_passwords.created_at IS 'Timestamp of when the record was created.';
COMMENT ON COLUMN user_passwords.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_passwords.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
