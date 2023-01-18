CREATE TABLE user_details (
  user_id UUID PRIMARY KEY REFERENCES users,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_name VARCHAR(255) CHECK(TRIM(first_name) <> ''),
  last_name VARCHAR(255) CHECK(TRIM(last_name) <> ''),
  email VARCHAR(255) NOT NULL CHECK (email LIKE '%@%')
);
DROP INDEX users_email;
CREATE UNIQUE INDEX users_email ON user_details (LOWER(email));
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_details FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_details IS 'Contains the details of user accounts such as their email, names, etc. It is not possible to soft delete these records -- only hard deletes are supported in this table.';
COMMENT ON COLUMN user_details.user_id IS 'The user this record belongs to.';
COMMENT ON COLUMN user_details.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_details.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_details.first_name IS 'The first name that the user has provided to the system.';
COMMENT ON COLUMN user_details.last_name IS 'The last name that the user has provided to the system.';
COMMENT ON COLUMN user_details.email IS 'User''s email';
-- Moving the old data
ALTER TABLE users
ADD COLUMN email_domain VARCHAR(255) CHECK(TRIM(email_domain) <> '');
UPDATE users
SET email_domain = lower(reverse(split_part(reverse(email), '@', 1)));
INSERT INTO user_details (user_id, first_name, last_name, email)
SELECT id,
  first_name,
  last_name,
  email
FROM users;
ALTER TABLE users DROP column first_name,
  DROP column last_name,
  DROP column email;
