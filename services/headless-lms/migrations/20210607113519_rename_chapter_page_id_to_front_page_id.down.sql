-- Add down migration script here
ALTER TABLE chapters
  RENAME COLUMN front_page_id TO page_id;
