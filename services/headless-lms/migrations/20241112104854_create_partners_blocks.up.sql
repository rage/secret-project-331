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
COMMENT ON COLUMN partners_blocks.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN partners_blocks.created_at IS 'Timestamp of when the record was created';
COMMENT ON COLUMN partners_blocks.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN partners_blocks.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN partners_blocks.content IS 'The content of the partners block that is derived from the Gutenberg Editor';
COMMENT ON COLUMN partners_blocks.course_id IS 'The course_id of the course the partners_block relates to.';
