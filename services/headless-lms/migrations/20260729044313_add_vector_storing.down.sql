-- Add down migration script here
ALTER TABLE course_prerequisites DROP COLUMN embedding;
ALTER TABLE course_audiences DROP COLUMN embedding;
DROP TABLE course_embeddings;
DROP EXTENSION vector;
