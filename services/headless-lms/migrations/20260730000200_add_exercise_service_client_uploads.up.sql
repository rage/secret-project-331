CREATE TABLE exercise_service_client_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  file_upload_id UUID NOT NULL UNIQUE REFERENCES file_uploads,
  exercise_id UUID NOT NULL REFERENCES exercises,
  user_id UUID NOT NULL REFERENCES users
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_service_client_uploads FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_exercise_service_client_uploads_lookup ON exercise_service_client_uploads (exercise_id, user_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_service_client_uploads_created ON exercise_service_client_uploads (created_at)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_service_client_uploads IS 'Files uploaded through the exercise-services client API, bound to the exercise and user they were uploaded for. Membership in this table is what scopes the exercise-service-client-upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images, certificates and iframe-uploaded answer files whose only references live inside opaque data_json answer blobs the host cannot parse, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization.';
COMMENT ON COLUMN exercise_service_client_uploads.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_service_client_uploads.created_at IS 'Timestamp when the record was created. The reaper''s retention window is measured from this.';
COMMENT ON COLUMN exercise_service_client_uploads.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_service_client_uploads.deleted_at IS 'Timestamp when the record was deleted. Set by the reaper, and kept rather than hard-deleted so a submit naming a reaped file can be answered with upload_expired instead of unknown_upload.';
COMMENT ON COLUMN exercise_service_client_uploads.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_service_client_uploads.exercise_id IS 'The exercise the file was uploaded for. A submit naming this file for any other exercise is rejected.';
COMMENT ON COLUMN exercise_service_client_uploads.user_id IS 'The user who uploaded the file. A submit by any other user is rejected.';
