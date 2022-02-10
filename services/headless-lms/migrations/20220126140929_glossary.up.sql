-- Add up migration script here
CREATE TABLE glossary (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  term VARCHAR(255) NOT NULL,
  definition TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON glossary FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE glossary IS 'A list of terms and their explanations.';
COMMENT ON COLUMN glossary.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN glossary.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN glossary.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN glossary.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN glossary.term IS 'The term, e.g. CS.';
COMMENT ON COLUMN glossary.definition IS 'The definition, e.g. computer science.';
COMMENT ON COLUMN glossary.course_id IS 'Each entry is related to a specific course.';
