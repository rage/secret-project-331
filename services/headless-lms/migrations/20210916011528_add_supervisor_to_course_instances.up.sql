-- Add up migration script here
ALTER TABLE course_instances
ADD COLUMN supervisor_name VARCHAR(255),
  ADD COLUMN supervisor_email VARCHAR(255);
