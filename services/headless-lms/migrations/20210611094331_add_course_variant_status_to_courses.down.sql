-- Add down migration script here
ALTER TABLE courses DROP variant_status;
DROP TYPE variant_status;
