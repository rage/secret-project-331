ALTER TABLE course_instances
ADD COLUMN join_code varchar(1024);
COMMENT ON COLUMN course_instances.join_code IS 'Regeneratable code that is used to join the course. If a user uses the code they will be added to join_code_uses -table to get access to the course';

ALTER TABLE courses
ADD COLUMN is_joinable_by_code_only BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.is_joinable_by_code_only IS 'Whether this course is only joinable by a join code that can be generated for a course instance'
