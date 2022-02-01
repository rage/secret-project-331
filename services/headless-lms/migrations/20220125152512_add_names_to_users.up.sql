-- Add up migration script here
ALTER TABLE users
ADD COLUMN first_name VARCHAR(255) CHECK(TRIM(first_name) <> ''),
  ADD COLUMN last_name VARCHAR(255) CHECK(TRIM(last_name) <> '');
