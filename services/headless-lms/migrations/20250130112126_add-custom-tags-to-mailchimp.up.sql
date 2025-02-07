CREATE TABLE mailchimp_course_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  marketing_mailing_list_access_token_id UUID NOT NULL REFERENCES marketing_mailing_list_access_tokens(id) ON DELETE CASCADE,
  course_language_group_id UUID NOT NULL REFERENCES course_language_groups(id),
  tag_name VARCHAR(255) NOT NULL,
  tag_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_course_tag UNIQUE (course_language_group_id, tag_name)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON mailchimp_course_tags FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE mailchimp_course_tags IS 'Stores a custom Mailchimp tag related to a course_language_group';
COMMENT ON COLUMN mailchimp_course_tags.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN mailchimp_course_tags.marketing_mailing_list_access_token_id IS 'Id of the mailing list this tag is associated with';
COMMENT ON COLUMN mailchimp_course_tags.course_language_group_id IS 'The course language group ID that the tag is associated with';
COMMENT ON COLUMN mailchimp_course_tags.tag_name IS 'Name of the Mailchimp tag assigned to the course-language group.';
COMMENT ON COLUMN mailchimp_course_tags.tag_id IS 'Mailchimp tag id assigned to the course-language group.';
COMMENT ON COLUMN mailchimp_course_tags.created_at IS 'Timestamp when the flag was created.';
COMMENT ON COLUMN mailchimp_course_tags.updated_at IS 'Timestamp when the flag was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN mailchimp_course_tags.deleted_at IS 'Timestamp when the flag was deleted. If null, the record is not deleted.';
