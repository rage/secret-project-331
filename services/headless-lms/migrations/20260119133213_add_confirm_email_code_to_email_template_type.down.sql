DELETE FROM email_templates
WHERE email_template_type = 'confirm_email_code';

DROP INDEX IF EXISTS unique_email_templates_type_language_general;

ALTER TYPE email_template_type
RENAME TO email_template_type_old;

CREATE TYPE email_template_type AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic'
);

ALTER TABLE email_templates
ADD COLUMN email_template_type_new email_template_type;

UPDATE email_templates
SET email_template_type_new = CASE
    WHEN email_template_type_old::text = 'reset_password_email' THEN 'reset_password_email'::email_template_type
    WHEN email_template_type_old::text = 'delete_user_email' THEN 'delete_user_email'::email_template_type
    WHEN email_template_type_old::text = 'generic' THEN 'generic'::email_template_type
    ELSE 'generic'::email_template_type
  END;

ALTER TABLE email_templates
ALTER COLUMN email_template_type_new
SET NOT NULL;

ALTER TABLE email_templates DROP COLUMN email_template_type_old;

ALTER TABLE email_templates
  RENAME COLUMN email_template_type_new TO email_template_type;

CREATE UNIQUE INDEX unique_email_templates_type_language_general ON email_templates(email_template_type, language)
WHERE course_id IS NULL;

DROP TYPE email_template_type_old;
