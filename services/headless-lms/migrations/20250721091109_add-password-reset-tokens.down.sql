DROP TABLE password_reset_tokens;

DELETE FROM email_templates
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates
ALTER COLUMN course_instance_id
SET NOT NULL;

COMMENT ON COLUMN email_templates.course_instance_id IS NULL;
COMMENT ON TABLE email_templates IS 'An email template table, which contains the email subject and content written in the Gutenberg Editor. Supports adding exercise points/completions threshold templates for course instances.';
