CREATE TABLE shared_rate_counts (
  key_digest BYTEA NOT NULL CHECK (length(key_digest) = 32),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (key_digest, window_seconds, window_start)
);
CREATE INDEX shared_rate_counts_window_start ON shared_rate_counts (window_start);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON shared_rate_counts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE shared_rate_counts IS 'Fixed-window event counts shared by every server instance, for limits that must hold across them. Windows that ended over a day ago are hard-deleted.';
COMMENT ON COLUMN shared_rate_counts.key_digest IS 'HMAC of what is counted, e.g. a form and a network.';
COMMENT ON COLUMN shared_rate_counts.window_seconds IS 'Length of the window.';
COMMENT ON COLUMN shared_rate_counts.window_start IS 'Start of the window, a multiple of its length since the epoch.';
COMMENT ON COLUMN shared_rate_counts.count IS 'Events counted in the window.';
COMMENT ON COLUMN shared_rate_counts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN shared_rate_counts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
