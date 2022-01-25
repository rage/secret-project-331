-- Add up migration script here
ALTER TABLE users
ADD name VARCHAR(255) CHECK(TRIM(name) <> '');
