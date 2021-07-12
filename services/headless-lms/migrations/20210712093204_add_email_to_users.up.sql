-- Add up migration script here
ALTER TABLE users
ADD email VARCHAR(255) NOT NULL;
