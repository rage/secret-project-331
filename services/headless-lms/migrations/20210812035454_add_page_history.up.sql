-- Add up migration script here
CREATE TYPE history_change_reason AS ENUM('page-saved', 'history-restored');
CREATE TABLE page_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  page_id UUID REFERENCES pages NOT NULL,
  content JSONB NOT NULL,
  history_change_reason history_change_reason NOT NULL,
  restored_from_id UUID REFERENCES page_history,
  author_user_id UUID REFERENCES users NOT NULL
);
COMMENT ON TYPE history_change_reason IS 'Contains all the methods that a page''s content can be changed.';
COMMENT ON TABLE page_history IS 'Contains all past and current revisions of each page''s content.';
COMMENT ON COLUMN page_history.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_history.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_history.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_history.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_history.page_id IS 'The page that this revision is of.';
COMMENT ON COLUMN page_history.content IS 'The unnormalized content of the page after the edit.';
COMMENT ON COLUMN page_history.history_change_reason IS 'The reason the page''s content changed';
COMMENT ON COLUMN page_history.restored_from_id IS 'If the page was restored from an earlier revision, contains the id of that revision.';
COMMENT ON COLUMN page_history.author_user_id IS 'The id of the user that made the change.';
