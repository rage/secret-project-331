-- Add up migration script here
ALTER TABLE users
ADD COLUMN legacy_id INT;
