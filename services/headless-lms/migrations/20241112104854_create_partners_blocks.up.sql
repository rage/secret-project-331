-- Add up migration script here
CREATE TABLE partners_blocks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  content JSONB,
  course_id UUID NOT NULL REFERENCES courses(id),
  CONSTRAINT unique_course_id UNIQUE (course_id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON partners_blocks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE partners_blocks IS 'A partners block is a custom content block displayed across all pages of a course, positioned directly above the site footer. This block showcases partner logos and links, providing easy access to relevant partner sites. The partners_blocks table stores the content data for this block. Content is created and managed through the Gutenberg Editor.';
