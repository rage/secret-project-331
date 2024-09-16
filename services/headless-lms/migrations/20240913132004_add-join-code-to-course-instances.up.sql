ALTER TABLE course_instances
ADD COLUMN join_code varchar(1024);
COMMENT ON COLUMN course_instances.join_code IS 'Regeneratable code that is used to join the course';
