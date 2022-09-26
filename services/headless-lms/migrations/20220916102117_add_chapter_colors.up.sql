ALTER TABLE chapters
ADD COLUMN color VARCHAR(128);

COMMENT ON COLUMN chapters.color IS 'Color of the chapter in the front page.';
