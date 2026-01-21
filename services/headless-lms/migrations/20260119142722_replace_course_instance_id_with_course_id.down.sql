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

CREATE UNIQUE INDEX unique_email_templates_type_language_general ON email_templates(email_template_type, language)
WHERE course_instance_id IS NULL;

ALTER TABLE email_templates DROP COLUMN course_id;
