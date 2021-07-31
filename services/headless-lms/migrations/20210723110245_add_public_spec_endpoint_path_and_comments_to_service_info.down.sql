-- Add down migration script here
COMMENT ON COLUMN exercise_service_info.public_spec_endpoint_path IS NULL;
COMMENT ON COLUMN exercise_service_info.submission_iframe_path IS NULL;
ALTER TABLE exercise_service_info DROP COLUMN public_spec_endpoint_path;
