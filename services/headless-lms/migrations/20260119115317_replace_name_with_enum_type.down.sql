ALTER TABLE email_templates
ADD COLUMN name VARCHAR(255);

UPDATE email_templates
SET name = CASE
    WHEN email_template_type = 'reset_password_email' THEN 'reset-password-email'
    WHEN email_template_type = 'delete_user_email' THEN 'delete-user-email'
    ELSE email_template_type::text
  END;

CREATE UNIQUE INDEX unique_email_templates_name_language_general ON email_templates(name, language)
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates DROP COLUMN email_template_type;

DROP TYPE email_template_type;
