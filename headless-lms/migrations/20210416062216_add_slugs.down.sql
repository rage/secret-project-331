-- Add down migration script here
ALTER TABLE courses
  DROP COLUMN slug;

ALTER TABLE organizations
  DROP COLUMN slug;
