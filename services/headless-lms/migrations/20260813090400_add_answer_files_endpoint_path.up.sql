ALTER TABLE exercise_service_info
ADD COLUMN answer_files_endpoint_path TEXT;

COMMENT ON COLUMN exercise_service_info.answer_files_endpoint_path IS 'Path to the endpoint that enumerates the files one of this service''s answers consists of. The host calls it when a submission names no host-stored uploads of its own -- an answer made in the service''s in-browser IFrame -- so that such a submission is recorded in exercise_task_submission_files and is downloadable exactly like one made by a native client. Null when the service cannot enumerate an answer''s files, which leaves its IFrame-made submissions with no files to download.';
