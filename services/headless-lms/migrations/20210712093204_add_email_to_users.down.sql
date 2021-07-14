-- Add down migration script here
DROP INDEX users_email;
ALTER TABLE users DROP COLUMN email;
