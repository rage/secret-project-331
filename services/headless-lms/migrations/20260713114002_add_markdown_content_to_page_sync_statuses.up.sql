ALTER TABLE chatbot_page_sync_statuses
ADD COLUMN converted_markdown_content TEXT;

COMMENT ON COLUMN chatbot_page_sync_statuses.converted_markdown_content IS 'The cleaned and LLM-converted page content in markdown format. This content is saved in the storage during synchronization. If the conversion to markdown failed, this field is null.'
