-- Add down migration script here
ALTER TABLE submissions
  DROP COLUMN user_id;
DROP TABLE users;

