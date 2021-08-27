-- Add down migration script here
DROP INDEX pages_content_search;
DROP TRIGGER trigger_set_pages_content_search ON pages;
DROP FUNCTION trigger_set_pages_content_search;
DROP FUNCTION extract_searchable_text_from_document_schema;
ALTER TABLE pages DROP COLUMN content_search_original_text;
ALTER TABLE pages DROP COLUMN content_search;
ALTER TABLE pages DROP COLUMN content_search_language;
ALTER TABLE courses DROP COLUMN content_search_language;
