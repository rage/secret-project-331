CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);


CREATE TRIGGER set_timestamp BEFORE
UPDATE ON password_reset_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE password_reset_tokens IS 'Stores one-time password reset tokens with expiration and usage tracking.';
COMMENT ON COLUMN password_reset_tokens.id IS 'A unique identifier for the resetting user password';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token sent to user for resetting their password.';
COMMENT ON COLUMN password_reset_tokens.user_id IS 'References the user the token belongs to.';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Time after which the token becomes invalid.';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Time when the token was used. Null if unused.';
COMMENT ON COLUMN password_reset_tokens.created_at IS 'Time when the token was created.';
COMMENT ON COLUMN password_reset_tokens.updated_at IS 'Time when the token was last updated. Automatically set by trigger.';
COMMENT ON COLUMN password_reset_tokens.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TABLE email_templates
ALTER COLUMN course_instance_id DROP NOT NULL;

ALTER TABLE email_templates
ADD COLUMN language VARCHAR(255);

COMMENT ON COLUMN email_templates.course_instance_id IS 'If not null the template is considered course instance specific. If null, the template is considered general.';

COMMENT ON COLUMN email_templates.language IS 'Language code for the template, e.g. fi, en, sv. If null, language is not specified';

COMMENT ON TABLE email_templates IS 'An email template table, which contains the email subject and content written in the Gutenberg Editor. Template is general if course_instance_id is NULL, or specific to a course instance if course_instance_id is set. Supports adding exercise points/completions threshold templates for course instances.';
