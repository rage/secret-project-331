-- NB! Migrating down will loose information on which was the original language version of a course.
-- ALTER TABLE courses
-- ADD COLUMN language_version_of_course_if UUID REFERENCES courses(id);
ALTER TABLE courses
ADD COLUMN language_version_of_course_id REFERENCES courses(id);
COMMENT ON COLUMN courses.language_version_of_course_id IS 'The original course, if this course is based on a translation.';
ALTER TABLE courses DROP COLUMN course_language_group_id;
DROP TABLE course_language_groups;
