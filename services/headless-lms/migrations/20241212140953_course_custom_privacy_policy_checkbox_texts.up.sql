CREATE TABLE course_custom_privacy_policy_checkbox_texts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  text_html TEXT NOT NULL,
  text_slug TEXT NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_custom_privacy_policy_checkbox_texts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_custom_privacy_policy_checkbox_texts IS 'Used to set the privacy policy checkbox texts in the course settings dialog when a course has a different privacy policy than all the other courses. (e.g., the Elements of AI course)';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.text_html IS 'The HTML content of the text.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.text_slug IS 'An identifier for the text, used to reference it in the course settings dialog.';
COMMENT ON COLUMN course_custom_privacy_policy_checkbox_texts.course_id IS 'The course in which the text is shown.';
