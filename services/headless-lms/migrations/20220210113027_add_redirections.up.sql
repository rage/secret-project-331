CREATE TABLE url_redirections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  destination_page_id UUID REFERENCES pages NOT NUll,
  old_url_path TEXT NOT NULL UNIQUE,
  course_id UUID REFERENCES courses NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON url_redirections FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE url_redirections IS 'A url redirection is typically created when a page is moved. The redirection will be used to redirect old links to the new location. If there''s a conflict with a page url and a redirection, the page will win the conflict.';
COMMENT ON COLUMN url_redirections.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN url_redirections.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN url_redirections.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN url_redirections.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN url_redirections.destination_page_id IS 'Which page the redirection will redirect to.';
COMMENT ON COLUMN url_redirections.old_url_path IS 'Url path where the page was previously available.';
COMMENT ON COLUMN url_redirections.course_id IS 'Course where the redirection is valid. A redirection only works within one course.';
