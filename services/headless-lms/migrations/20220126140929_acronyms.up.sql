-- Add up migration script here
CREATE TABLE acronyms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  acronym VARCHAR(255) NOT NULL,
  meaning TEXT NOT NULL,
  language VARCHAR(15) CHECK (language ~ '^[a-z]{2,3}$'),
  course_id UUID NOT NULL REFERENCES courses
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON acronyms FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE acronyms IS 'An explanation for an acronym.';
COMMENT ON COLUMN acronyms.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN acronyms.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN acronyms.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN acronyms.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN acronyms.acronym IS 'The acronym, e.g. CS.';
COMMENT ON COLUMN acronyms.meaning IS 'The explanation, e.g. computer science.';
COMMENT ON COLUMN acronyms.language IS 'The language code for the language the meaning is written in.';
COMMENT ON COLUMN acronyms.course_id IS 'Each acronym is related to a specific course.';
