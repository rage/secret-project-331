-- Add down migration script here
ALTER TABLE exercise_services DROP CONSTRAINT exercise_services_slug_key;
CREATE UNIQUE INDEX exercise_services_slug_key ON exercise_services (id, slug);
