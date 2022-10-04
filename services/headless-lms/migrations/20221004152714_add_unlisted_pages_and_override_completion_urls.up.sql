-- Add up migration script here
ALTER TABLE pages
ADD COLUMN unlisted BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN pages.unlisted IS 'Whether or not this page should be listed or normally accessible.';
