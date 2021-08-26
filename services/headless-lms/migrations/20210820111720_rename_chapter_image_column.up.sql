-- Add up migration script here
ALTER TABLE chapters
  RENAME COLUMN chapter_image TO chapter_image_path;
COMMENT ON COLUMN chapters.chapter_image_path IS 'Chapter image path is converted to chapter image url once fetched from database.';
