CREATE TABLE page_read_statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  page_id UUID REFERENCES pages(id) NOT NULL,
  page_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  block_statuses JSONB,
  UNIQUE NULLS NOT DISTINCT(user_id, page_id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_read_statuses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE page_read_statuses IS 'Page read status tells whether a student has read a page. This can be used to track a students progress and tell them where they left off.';
COMMENT ON COLUMN page_read_statuses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_read_statuses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_read_statuses.updated_at IS 'Timestamp when the record was last updated.';
COMMENT ON COLUMN page_read_statuses.deleted_at IS 'Timestamp when the record was deleted.';
COMMENT ON COLUMN page_read_statuses.user_id IS 'The user that is reading the page.';
COMMENT ON COLUMN page_read_statuses.page_id IS 'The page that is being read.';
COMMENT ON COLUMN page_read_statuses.page_read IS 'Status whether the page has been read or not';
COMMENT ON COLUMN page_read_statuses.read_at IS 'Timestamp when the page was read.';
COMMENT ON COLUMN page_read_statuses.block_statuses IS 'JSON that contains information of how long each content block on page has been viewed and when were they last viewed.';
