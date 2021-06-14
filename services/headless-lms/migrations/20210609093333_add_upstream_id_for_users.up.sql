-- Add up migration script here
ALTER TABLE users
ADD COLUMN upstream_id INT;
