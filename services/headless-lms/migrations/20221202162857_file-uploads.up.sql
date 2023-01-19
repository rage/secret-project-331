CREATE TABLE file_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL,
  mime VARCHAR(32) NOT NULL,
  uploaded_by_user UUID REFERENCES users
);
COMMENT ON TABLE file_uploads IS 'Stores metadata regarding files uploaded to the server by users or exercise services.';
COMMENT ON COLUMN file_uploads.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN file_uploads.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN file_uploads.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN file_uploads.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN file_uploads.name IS 'The name of the uploaded file.';
COMMENT ON COLUMN file_uploads.path IS 'The path to the uploaded file.';
COMMENT ON COLUMN file_uploads.mime IS 'The mime type of the uploaded file.';
COMMENT ON COLUMN file_uploads.uploaded_by_user IS 'The id of the user who uploaded the file. Null for uploads from other sources, such as exercise services.';
