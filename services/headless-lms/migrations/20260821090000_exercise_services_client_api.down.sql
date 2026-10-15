ALTER TABLE exercise_service_info DROP COLUMN answer_files_endpoint_path;

DROP TABLE exercise_service_client_uploads;

DROP TABLE exercise_task_submission_files;

ALTER TABLE exercise_service_info DROP COLUMN build_user_answer_endpoint_path;

DROP TABLE IF EXISTS oauth_device_codes;
DROP TYPE IF EXISTS device_code_status;

DROP TABLE IF EXISTS exercise_slide_submission_shares;
