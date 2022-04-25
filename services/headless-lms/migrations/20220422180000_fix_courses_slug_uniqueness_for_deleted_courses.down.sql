-- Add down migration script here
DROP INDEX courses_slug_key_when_not_deleted;
ALTER TABLE courses
ADD CONSTRANT courses_slug_key UNIQUE (slug);
