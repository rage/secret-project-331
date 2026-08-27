DROP TABLE rejected_exercise_task_submission_files;

ALTER TABLE exercise_service_info DROP COLUMN produces_file_answers;
ALTER TABLE exercise_service_info DROP COLUMN supports_native_client;

ALTER TABLE exercise_service_info
ADD COLUMN build_user_answer_endpoint_path TEXT;
ALTER TABLE exercise_service_info
ADD COLUMN answer_files_endpoint_path TEXT;

COMMENT ON COLUMN exercise_service_info.build_user_answer_endpoint_path IS 'Path to the endpoint that turns host-stored uploaded files into this service''s UserAnswer. Null when the service does not support native (non-browser) clients; the exercise-services client API serves only services that declare it.';
COMMENT ON COLUMN exercise_service_info.answer_files_endpoint_path IS 'Path to the endpoint that enumerates the files one of this service''s answers consists of. The host calls it when a submission names no host-stored uploads of its own -- an answer made in the service''s in-browser IFrame -- so that such a submission is recorded in exercise_task_submission_files and is downloadable exactly like one made by a native client. Null when the service cannot enumerate an answer''s files, which leaves its IFrame-made submissions with no files to download.';

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

ALTER TABLE file_uploads DROP COLUMN size_bytes;

DELETE FROM rejected_exercise_task_submissions
WHERE data_json IS NULL;
ALTER TABLE rejected_exercise_task_submissions
DROP CONSTRAINT rejected_exercise_task_submissions_json_answer_has_data;
ALTER TABLE rejected_exercise_task_submissions
ALTER COLUMN data_json SET NOT NULL;
ALTER TABLE rejected_exercise_task_submissions
DROP COLUMN answer_kind;

ALTER TABLE exercise_task_submissions
DROP CONSTRAINT exercise_task_submissions_json_answer_has_data;
ALTER TABLE exercise_task_submissions
DROP COLUMN answer_kind;

DROP TYPE answer_kind;

COMMENT ON TABLE exercise_task_submission_files IS 'Links a task submission to the files the client uploaded for it, so the host can serve a submission''s files back without interpreting the exercise service''s answer.';
