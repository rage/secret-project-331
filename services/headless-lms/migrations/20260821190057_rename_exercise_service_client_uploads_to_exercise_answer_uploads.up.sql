ALTER TABLE exercise_service_client_uploads
RENAME TO exercise_answer_uploads;
ALTER INDEX exercise_service_client_uploads_pkey RENAME TO exercise_answer_uploads_pkey;
ALTER INDEX uq_exercise_service_client_uploads_file_upload_id RENAME TO uq_exercise_answer_uploads_file_upload_id;
ALTER INDEX idx_exercise_service_client_uploads_lookup RENAME TO idx_exercise_answer_uploads_lookup;
ALTER INDEX idx_exercise_service_client_uploads_created RENAME TO idx_exercise_answer_uploads_created;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_file_upload_id_fkey TO exercise_answer_uploads_file_upload_id_fkey;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_exercise_id_fkey TO exercise_answer_uploads_exercise_id_fkey;
ALTER TABLE exercise_answer_uploads
RENAME CONSTRAINT exercise_service_client_uploads_user_id_fkey TO exercise_answer_uploads_user_id_fkey;

CREATE TYPE answer_upload_origin AS ENUM ('native_client', 'iframe');
ALTER TABLE exercise_answer_uploads
ADD COLUMN origin answer_upload_origin NOT NULL DEFAULT 'native_client';
ALTER TABLE exercise_answer_uploads
ALTER COLUMN origin DROP DEFAULT;

COMMENT ON TABLE exercise_answer_uploads IS 'Files uploaded to be named in an exercise answer, bound to the uploader and the exercise so a submit can verify the naming. Membership in this table is what scopes the answer upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images and certificates, which have no binding here, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization. Retention is per origin.';
COMMENT ON COLUMN exercise_answer_uploads.origin IS 'The upload channel that created the row. Selects the reaper''s retention window: one hour for native_client, seven days for iframe.';
