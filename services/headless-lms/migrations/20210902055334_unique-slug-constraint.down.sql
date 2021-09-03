-- Add down migration script here
DROP INDEX exercise_services_unique_slug;
ALTER TABLE exercise_services ADD CONSTRAINT exercise_services_slug_key UNIQUE (slug);
