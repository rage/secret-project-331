ALTER TABLE exercise_answer_uploads
DROP COLUMN origin;
DROP TYPE answer_upload_origin;

ALTER TABLE exercise_answer_uploads
RENAME TO exercise_service_client_uploads;
ALTER INDEX exercise_answer_uploads_pkey RENAME TO exercise_service_client_uploads_pkey;
ALTER INDEX uq_exercise_answer_uploads_file_upload_id RENAME TO uq_exercise_service_client_uploads_file_upload_id;
ALTER INDEX idx_exercise_answer_uploads_lookup RENAME TO idx_exercise_service_client_uploads_lookup;
ALTER INDEX idx_exercise_answer_uploads_created RENAME TO idx_exercise_service_client_uploads_created;
ALTER TABLE exercise_service_client_uploads
RENAME CONSTRAINT exercise_answer_uploads_file_upload_id_fkey TO exercise_service_client_uploads_file_upload_id_fkey;
ALTER TABLE exercise_service_client_uploads
RENAME CONSTRAINT exercise_answer_uploads_exercise_id_fkey TO exercise_service_client_uploads_exercise_id_fkey;
ALTER TABLE exercise_service_client_uploads
RENAME CONSTRAINT exercise_answer_uploads_user_id_fkey TO exercise_service_client_uploads_user_id_fkey;

COMMENT ON TABLE exercise_service_client_uploads IS 'Files uploaded through the exercise-services client API, bound to the exercise and user they were uploaded for. Membership in this table is what scopes the exercise-service-client-upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images, certificates and iframe-uploaded answer files whose only references live inside opaque data_json answer blobs the host cannot parse, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization.';
