-- Add up migration script here
CREATE TABLE page_audio_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL
);
COMMENT ON TABLE page_audio_files IS 'Stores data regarding audio files uploaded to any page by users.';
COMMENT ON COLUMN page_audio_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_audio_files.page_id IS 'The page the audio files belong to.';
COMMENT ON COLUMN page_audio_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_audio_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_audio_files.path IS 'The path to the uploaded audio file.';
COMMENT ON COLUMN page_audio_files.mime_type IS 'The mime type of the uploaded file.';