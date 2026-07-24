CREATE TABLE course_page_markdown_content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  markdown_content TEXT NOT NULL
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_page_markdown_content FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_page_markdown_content IS 'Course page content that has been converted from Gutenberg blocks to Markdown format with an LLM.';
COMMENT ON COLUMN course_page_markdown_content.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_page_markdown_content.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_page_markdown_content.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_page_markdown_content.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_page_markdown_content.markdown_content IS 'The markdown content of the page.';


ALTER TABLE chatbot_page_sync_statuses
ADD COLUMN converted_markdown_content_id UUID REFERENCES course_page_markdown_content(id);

COMMENT ON COLUMN chatbot_page_sync_statuses.converted_markdown_content_id IS 'Refers to the cleaned and LLM-converted page content in markdown format. This content is saved in the Azure storage during synchronization. If the conversion to markdown failed, this field is null.';
