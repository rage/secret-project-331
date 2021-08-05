-- Add down migration script here
DROP INDEX pages_content_search;
DROP TRIGGER trigger_set_pages_content_search ON pages;
DROP FUNCTION trigger_set_pages_content_search;
ALTER TABLE pages DROP column content_search;
