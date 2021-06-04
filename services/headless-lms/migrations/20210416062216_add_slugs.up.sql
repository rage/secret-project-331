-- Add up migration script here
ALTER TABLE courses
  ADD slug VARCHAR(255) NOT NULL UNIQUE DEFAULT substring(md5(random()::text), 0, 15);

ALTER TABLE organizations
  ADD slug VARCHAR(255) NOT NULL UNIQUE DEFAULT substring(md5(random()::text), 0, 15);
