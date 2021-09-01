-- Add proper constraints to existing tables.
CREATE UNIQUE INDEX courses_user_course_settings_key ON courses (id, course_language_group_id);
CREATE UNIQUE INDEX course_instance_enrollments_user_course_settings_key ON course_instance_enrollments (user_id, course_id, course_instance_id);
-- Create new table
CREATE TABLE user_course_settings (
  user_id UUID NOT NULL REFERENCES users(id),
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  current_course_id UUID NOT NULL REFERENCES courses(id),
  current_course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  PRIMARY KEY (user_id, course_language_group_id),
  FOREIGN KEY (
    user_id,
    current_course_id,
    current_course_instance_id
  ) REFERENCES course_instance_enrollments (user_id, course_id, course_instance_id),
  FOREIGN KEY (current_course_id, course_language_group_id) REFERENCES courses (id, course_language_group_id)
);
COMMENT ON TABLE user_course_settings IS 'User setting for a language version group of courses.';
COMMENT ON COLUMN user_course_settings.user_id IS 'The user that these settings should be applied for.';
COMMENT ON COLUMN user_course_settings.course_language_group_id IS 'Group of courses that these settings are used for.';
COMMENT ON COLUMN user_course_settings.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_course_settings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_course_settings.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_course_settings.current_course_id IS 'Current course language version that the user is on. Used as a constraint for valid course instance.';
COMMENT ON COLUMN user_course_settings.current_course_instance_id IS 'Current course instance that the user is on.';
-- Add records based on the old 'course_instance_enrollments.current' column.
INSERT INTO user_course_settings (
    user_id,
    course_language_group_id,
    current_course_id,
    current_course_instance_id
  )
SELECT cie.user_id,
  courses.course_language_group_id,
  cie.course_id,
  cie.course_instance_id
FROM course_instance_enrollments cie
  JOIN courses ON (cie.course_id = courses.id)
WHERE cie.current = TRUE;
ALTER TABLE course_instance_enrollments DROP COLUMN current;
