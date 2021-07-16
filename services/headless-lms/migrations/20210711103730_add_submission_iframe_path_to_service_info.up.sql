-- Add up migration script here
ALTER TABLE exercise_service_info
ADD submission_iframe_path VARCHAR(255) NOT NULL;
