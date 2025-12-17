DROP TABLE password_reset_tokens;

DELETE FROM email_deliveries
WHERE email_template_id IN (
    SELECT id
    FROM email_templates
    WHERE course_instance_id IS NULL
  );

DELETE FROM email_templates
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates
ALTER COLUMN course_instance_id
SET NOT NULL;

ALTER TABLE email_templates DROP COLUMN IF EXISTS language;

DROP INDEX IF EXISTS unique_email_templates_name_language_general;


COMMENT ON TABLE email_templates IS 'An email template table, which contains the email subject and content written in the Gutenberg Editor. Supports adding exercise points/completions threshold templates for course instances.';
