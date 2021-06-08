-- Add up migration script here
ALTER TABLE chapters
  RENAME COLUMN page_id TO front_page_id;
