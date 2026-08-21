ALTER TABLE course_prerequisites DROP COLUMN embedding;
ALTER TABLE course_audiences DROP COLUMN embedding;
DROP INDEX IF EXISTS course_prerequisites_prerequisite_trgm_idx;
DROP INDEX IF EXISTS course_audiences_audience_trgm_idx;
DROP TABLE course_embeddings;
DROP EXTENSION vector;
