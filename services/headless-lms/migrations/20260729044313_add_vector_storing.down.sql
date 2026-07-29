-- Add down migration script here
ALTER TABLE course_prerequisites DROP COLUMN embedding;
ALTER TABLE course_audiences DROP COLUMN embedding;
ALTER TABLE courses DROP COLUMN embedding;
DROP EXTENSION vector;
