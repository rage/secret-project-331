-- Add up migration script here
ALTER TABLE pages
ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN pages.hidden IS 'Whether or not this page should be publicly visible.';
