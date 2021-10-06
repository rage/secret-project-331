-- Add down migration script here
ALTER TABLE course_instances DROP supervisor_name,
  DROP supervisor_email;
