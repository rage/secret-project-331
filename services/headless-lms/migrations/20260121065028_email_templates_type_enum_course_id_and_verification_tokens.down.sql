DROP TABLE IF EXISTS email_verification_tokens;

ALTER TABLE email_templates
ADD COLUMN course_instance_id UUID REFERENCES course_instances;

UPDATE email_templates
SET course_instance_id = (
    SELECT course_instances.id
    FROM course_instances
    WHERE course_instances.course_id = email_templates.course_id
    ORDER BY course_instances.created_at ASC
    LIMIT 1
  );

DROP INDEX unique_email_templates_type_language_general;

CREATE UNIQUE INDEX unique_email_templates_type_language_general ON email_templates(
  email_template_type,
  language,
  deleted_at
) NULLS NOT DISTINCT
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates DROP COLUMN course_id;

ALTER TABLE email_templates
ADD COLUMN name VARCHAR(255);

UPDATE email_templates
SET name = CASE
    WHEN email_template_type = 'reset_password_email' THEN 'reset-password-email'
    WHEN email_template_type = 'delete_user_email' THEN 'delete-user-email'
    ELSE email_template_type::text
  END;

DROP INDEX unique_email_templates_type_language_general;

CREATE UNIQUE INDEX unique_email_templates_name_language_general ON email_templates(name, language, deleted_at) NULLS NOT DISTINCT
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates DROP COLUMN email_template_type;

DROP TYPE email_template_type;
