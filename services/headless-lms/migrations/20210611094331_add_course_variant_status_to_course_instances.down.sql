-- Add down migration script here
ALTER TABLE course_instances DROP variant_status;
DROP TYPE variant_status;
