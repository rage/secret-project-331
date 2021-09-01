-- Add up migration script here
CREATE TABLE course_language_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_language_groups FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_language_groups IS 'Group of courses that have the same content but in different languages.';
COMMENT ON COLUMN course_language_groups.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_language_groups.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_language_groups.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_language_groups.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
ALTER TABLE courses
ADD COLUMN course_language_group_id UUID REFERENCES course_language_groups(id);
COMMENT ON COLUMN courses.course_language_group_id IS 'Course group that this language version is a part of.';
-- Stupid workaround to create entry for each parent course
-- First create course language group with reference to each of the parent course.
ALTER TABLE course_language_groups
ADD COLUMN temp_course_id UUID NOT NULL REFERENCES courses(id);
INSERT INTO course_language_groups (temp_course_id)
SELECT id
FROM courses
WHERE language_version_of_course_id IS NULL;
-- Then reverse the direction of references.
UPDATE courses
SET course_language_group_id = clg.id
FROM course_language_groups clg
WHERE clg.temp_course_id = courses.id;
ALTER TABLE course_language_groups DROP COLUMN temp_course_id;
-- Finally add references for other language versions.
UPDATE courses
SET course_language_group_id = c.course_language_group_id
FROM courses c
WHERE c.id = courses.language_version_of_course_id;
ALTER TABLE courses
ALTER COLUMN course_language_group_id
SET NOT NULL;
ALTER TABLE courses DROP COLUMN language_version_of_course_id;
