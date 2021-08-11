-- Add up migration script here
CREATE TABLE feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users,
  course_id UUID NOT NULL REFERENCES courses,
  feedback_given VARCHAR(1000) NOT NULL,
  marked_as_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON feedback FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE feedback IS 'Users can send feedback to help improve the course material. Feedback consists of written text from the user.';
COMMENT ON COLUMN feedback.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN feedback.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN feedback.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN feedback.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN feedback.user_id IS 'The user that sent the feedback.';
COMMENT ON COLUMN feedback.course_id IS 'The course the feedback is for.';
COMMENT ON COLUMN feedback.feedback_given IS 'The feedback the user wrote.';
CREATE TABLE block_feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES feedback,
  block_id UUID NOT NULL,
  block_text VARCHAR(10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON block_feedback FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE block_feedback IS 'Used to link feedback to the related blocks.';
COMMENT ON COLUMN block_feedback.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN block_feedback.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN block_feedback.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN block_feedback.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN block_feedback.feedback_id IS 'The id of the feedback.';
COMMENT ON COLUMN block_feedback.block_id IS 'The id of the block.';
COMMENT ON COLUMN block_feedback.block_text IS 'The textual contents of the block, if any.';
