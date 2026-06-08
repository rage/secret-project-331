CREATE TABLE user_ai_usage_notice_acknowledgements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX user_ai_usage_notice_ack_user_course_uniqueness ON user_ai_usage_notice_acknowledgements (user_id, course_id)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_ai_usage_notice_acknowledgements FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_ai_usage_notice_acknowledgements IS 'Records that a user has read and agreed to the AI-usage / academic-integrity notice for a given course. One acknowledgement per user per course.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.user_id IS 'The user who acknowledged the notice.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.course_id IS 'The course the acknowledgement applies to.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_ai_usage_notice_acknowledgements.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
