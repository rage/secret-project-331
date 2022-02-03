-- Add down migration script here
ALTER TABLE users DROP COLUMN first_name,
  DROP COLUMN last_name;
