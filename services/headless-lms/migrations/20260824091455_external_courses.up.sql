CREATE TABLE external_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255) NOT NULL,
  name_embedding vector(1536),
  description TEXT,
  description_embedding vector(1536),
  url VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON external_courses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE external_courses IS 'External courses are other mooc-courses not on courses.mooc.fi';
COMMENT ON COLUMN external_courses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN external_courses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN external_courses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN external_courses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN external_courses.name IS 'Human readable name of the course.';
COMMENT ON COLUMN external_courses.name_embedding IS 'Embedding vector of the course name, used for semantic searching.';
COMMENT ON COLUMN external_courses.description IS 'The description of a course summarizes what the course teaches and what you have to do in it.';
COMMENT ON COLUMN external_courses.description_embedding IS 'Embedding vector of the course description, used for semantic searching.';
COMMENT ON COLUMN external_courses.url IS 'The URL address to the external platform where to course is hosted.';

CREATE INDEX ON external_courses USING hnsw (name_embedding vector_ip_ops)
WHERE deleted_at IS NULL;
CREATE INDEX ON external_courses USING hnsw (description_embedding vector_ip_ops)
WHERE deleted_at IS NULL;
