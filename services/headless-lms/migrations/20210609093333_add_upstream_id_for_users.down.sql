-- Add down migration script here
ALTER TABLE users DROP COLUMN upstream_id;
