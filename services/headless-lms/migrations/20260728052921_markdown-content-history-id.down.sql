DROP INDEX IF EXISTS course_page_markdown_content_page_history_id;

ALTER TABLE course_page_markdown_content DROP COLUMN page_history_id;
