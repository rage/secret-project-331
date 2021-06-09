-- Add down migration script here
ALTER TABLE users DROP COLUMN legacy_id;
