CREATE TYPE email_template_type AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic'
);

ALTER TABLE email_templates
ADD COLUMN email_template_type email_template_type;

UPDATE email_templates
SET email_template_type = CASE
    WHEN name = 'reset-password-email' THEN 'reset_password_email'::email_template_type
    WHEN name = 'delete-user-email' THEN 'delete_user_email'::email_template_type
    ELSE 'generic'::email_template_type
  END;

ALTER TABLE email_templates
ALTER COLUMN email_template_type
SET NOT NULL;


CREATE UNIQUE INDEX unique_email_templates_type_language_general ON email_templates(
  email_template_type,
  language,
  deleted_at
) NULLS NOT DISTINCT
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates DROP COLUMN name;

COMMENT ON TYPE email_template_type IS 'Type of email template: generic templates do not support automated placeholder replacements, others do.';
COMMENT ON COLUMN email_templates.email_template_type IS 'Type of email template. Determines which placeholder replacements are available, and makes them available to automations.';
