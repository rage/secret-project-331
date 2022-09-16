ALTER TABLE chapters
ADD COLUMN color VARCHAR(128) DEFAULT '#065853' NOT NULL;

COMMENT ON COLUMN chapters.color IS 'Color of the chapter in the front page. Defaults to "#065853"';