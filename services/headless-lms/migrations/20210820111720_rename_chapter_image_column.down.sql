-- Add down migration script here
ALTER TABLE chapters
  RENAME COLUMN chapter_image_path TO chapter_image;
COMMENT ON COLUMN chapters.chapter_image IS '';
