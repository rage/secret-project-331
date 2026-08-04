-- Add up migration script here
CREATE EXTENSION vector;
ALTER TABLE course_prerequisites
ADD COLUMN embedding vector(1536);
ALTER TABLE course_audiences
ADD COLUMN embedding vector(1536);
ALTER TABLE courses
ADD COLUMN embedding vector(1536);
CREATE INDEX ON course_prerequisites USING hnsw (embedding vector_ip_ops);
CREATE INDEX ON course_audiences USING hnsw (embedding vector_ip_ops);
CREATE INDEX ON courses USING hnsw (embedding vector_ip_ops);
