-- Add down migration script here
ALTER TABLE roles DROP created_at,
  DROP updated_at,
  DROP deleted_at;
DROP TRIGGER set_timestamp ON roles;
