-- Add up migration script here
CREATE EXTENSION vector;
ALTER TABLE course_prerequisites
ADD COLUMN embedding vector(1536);
ALTER TABLE course_audiences
ADD COLUMN embedding vector(1536);
ALTER TABLE courses
ADD COLUMN embedding vector(1536);
