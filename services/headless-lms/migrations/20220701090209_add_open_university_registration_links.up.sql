-- Add up migration script here
CREATE TABLE open_university_registration_links (
  uh_course_code VARCHAR(255) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  registration_link VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON open_university_registration_links FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE open_university_registration_links IS 'Table for active completion registration links. Completion links change over time, so they need to be updated occasionally.';
COMMENT ON COLUMN open_university_registration_links.uh_course_code IS 'University of Helsinki''s recognized identifier for the course. E.g. BSCS1001 (Introduction to Programming)';
COMMENT ON COLUMN open_university_registration_links.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN open_university_registration_links.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN open_university_registration_links.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN open_university_registration_links.registration_link IS 'Absolute url for registering a completion to Open University.';
