-- Add down migration script here
ALTER TABLE course_page_markdown_content DROP COLUMN page_history_id;
