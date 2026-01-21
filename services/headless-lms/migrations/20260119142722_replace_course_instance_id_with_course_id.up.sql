ALTER TABLE email_templates
ADD COLUMN course_id UUID REFERENCES courses;

UPDATE email_templates
SET course_id = (
    SELECT course_instances.course_id
    FROM course_instances
    WHERE course_instances.id = email_templates.course_instance_id
  );

DROP INDEX unique_email_templates_type_language_general;

CREATE UNIQUE INDEX unique_email_templates_type_language_general ON email_templates(
  email_template_type,
  language,
  deleted_at
) NULLS NOT DISTINCT
WHERE course_id IS NULL;

ALTER TABLE email_templates DROP COLUMN course_instance_id;

COMMENT ON COLUMN email_templates.course_id IS 'The course this email template belongs to. NULL for generic templates that are not course-specific.';
