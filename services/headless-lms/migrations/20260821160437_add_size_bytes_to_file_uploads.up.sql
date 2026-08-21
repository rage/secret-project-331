ALTER TABLE file_uploads ADD COLUMN size_bytes BIGINT;
COMMENT ON COLUMN file_uploads.size_bytes IS 'Size of the stored object in bytes, measured while receiving it. Null for rows created before the column existed.';
