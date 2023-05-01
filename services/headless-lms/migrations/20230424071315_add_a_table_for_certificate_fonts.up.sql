CREATE TABLE certificate_fonts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  file_path TEXT NOT NULL,
  file_upload_id UUID NOT NULL REFERENCES file_uploads(id),
  display_name TEXT NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON certificate_fonts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE certificate_fonts IS 'When renderding certificates, we will load all the fonts from this table to be available during rendering. Fonts that are not in this table will not be rendered.';
COMMENT ON COLUMN certificate_fonts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN certificate_fonts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN certificate_fonts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN certificate_fonts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN certificate_fonts.file_path IS 'Path to the uploaded font file. The same path can be found though file_upload_id -> path. This field is copied here so that we can avoid a join. The file_uploads table is expected to grow very large.';
COMMENT ON COLUMN certificate_fonts.file_upload_id IS 'The record for the uploaded font file.';
COMMENT ON COLUMN certificate_fonts.display_name IS 'A name so that we can remember which record is for which font. Does not affect the font name used in the rendering -- that comes from the font file itself.';