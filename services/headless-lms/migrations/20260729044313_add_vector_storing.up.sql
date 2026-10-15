CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE course_prerequisites
ADD COLUMN embedding vector(1536);

ALTER TABLE course_audiences
ADD COLUMN embedding vector(1536);

CREATE TABLE course_embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses,
  title_embedding vector(1536),
  description_embedding vector(1536)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_embeddings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_embeddings IS 'Used for semantically finding courses, holding embedding vectors';
COMMENT ON COLUMN course_embeddings.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_embeddings.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_embeddings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_embeddings.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_embeddings.course_id IS 'Embeddings belong to a specific course.';
COMMENT ON COLUMN course_embeddings.title_embedding IS 'Embedding vector of the course title.';
COMMENT ON COLUMN course_embeddings.description_embedding IS 'Embedding vector of the course description.';


CREATE INDEX ON course_prerequisites USING hnsw (embedding vector_ip_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON course_prerequisites USING GIST (prerequisite gist_trgm_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON course_audiences USING hnsw (embedding vector_ip_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON course_audiences USING GIST (audience gist_trgm_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON course_embeddings USING hnsw (title_embedding vector_ip_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON course_embeddings USING hnsw (description_embedding vector_ip_ops)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX course_embeddings_active_course_id_idx ON course_embeddings (course_id)
WHERE deleted_at IS NULL;
