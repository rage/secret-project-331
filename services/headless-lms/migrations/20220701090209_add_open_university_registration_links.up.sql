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
COMMENT ON TABLE open_university_registration_links IS '';
COMMENT ON COLUMN open_university_registration_links.uh_course_code IS '';
COMMENT ON COLUMN open_university_registration_links.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN open_university_registration_links.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN open_university_registration_links.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN open_university_registration_links.registration_link IS '';
