UPDATE chatbot_page_sync_statuses
SET converted_markdown_content_id = NULL;

DELETE FROM course_page_markdown_content;

ALTER TABLE course_page_markdown_content
ADD COLUMN page_history_id UUID NOT NULL REFERENCES page_history(id);

COMMENT ON COLUMN course_page_markdown_content.page_history_id IS 'The page history version that this Markdown was generated from.';

CREATE INDEX course_page_markdown_content_page_history_id ON course_page_markdown_content(page_history_id);
