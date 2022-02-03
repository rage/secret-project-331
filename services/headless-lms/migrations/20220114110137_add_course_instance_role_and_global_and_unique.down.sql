-- Add down migration script here
ALTER TABLE roles DROP CONSTRAINT single_role_for_domain,
  DROP course_instance_id,
  DROP is_global;
