-- Add up migration script here
CREATE TABLE ended_processed_exams (
  exam_id UUID PRIMARY KEY REFERENCES exams,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON ended_processed_exams FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE ended_processed_exams IS 'Helper table for listing ended exams that have been processed.';
COMMENT ON COLUMN ended_processed_exams.exam_id IS 'Exam that is marked as processed.';
COMMENT ON COLUMN ended_processed_exams.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN ended_processed_exams.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN ended_processed_exams.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
