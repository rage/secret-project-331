-- Add up migration script here
CREATE TABLE privacy_link (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  link_title VARCHAR(255) NOT NULL,
  link_url TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  CONSTRAINT unique_course_id UNIQUE (course_id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON partners_blocks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE privacy_links IS 'This table stores privacy link data associated with specific courses.';
COMMENT ON COLUMN privacy_links.id IS 'A unique identifier for the privacy link record.';
COMMENT ON COLUMN privacy_links.created_at IS 'Timestamp of when the record was created.';
COMMENT ON COLUMN privacy_links.updated_at IS 'Timestamp of the last update, automatically set by the set_timestamp trigger.';
COMMENT ON COLUMN privacy_links.deleted_at IS 'Timestamp of when the record was marked as deleted, if applicable.';
COMMENT ON COLUMN privacy_links.link_title IS 'The title or description of the privacy link.';
COMMENT ON COLUMN privacy_links.link_url IS 'The URL for the privacy link content.';
COMMENT ON COLUMN privacy_links.course_id IS 'The course ID the privacy link is associated with.';
