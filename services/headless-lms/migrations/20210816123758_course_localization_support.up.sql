-- Create new table for course settings
CREATE TABLE user_course_settings (
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  current_course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  UNIQUE (user_id, course_id)
);
COMMENT ON TABLE user_course_settings IS 'User specific settings for different courses.';
COMMENT ON COLUMN user_course_settings.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN user_course_settings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_course_settings.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_course_settings.user_id IS 'User identifier.';
COMMENT ON COLUMN user_course_settings.course_id IS 'Course indentifier. Should always be the base course for translations, as in where language_version_of_course_id is null.';
COMMENT ON COLUMN user_course_settings.current_course_instance_id IS 'The course instance that the user is currently enrolled to.';
-- Add new columns to course table
ALTER TABLE courses
ADD COLUMN locale VARCHAR(10) CHECK (locale ~ '^[a-z]{2}_[A-Z]{2}$'),
  ADD COLUMN copied_from_course_id UUID REFERENCES courses(id),
  ADD COLUMN language_version_of_course_id UUID REFERENCES courses(id);
UPDATE courses
SET locale = 'en_US'
WHERE locale IS NULL;
ALTER TABLE courses
ALTER COLUMN locale
SET NOT NULL;
COMMENT ON COLUMN courses.locale IS 'Locale indentifier for the course';
COMMENT ON COLUMN courses.copied_from_course_id IS 'The original course that this course is a copy of. If null, this is the original course.';
COMMENT ON COLUMN courses.language_version_of_course_id IS 'The original course, if this course is based on a translation.';
