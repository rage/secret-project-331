-- Add up migration script here
ALTER TABLE exercise_service_info
ADD COLUMN public_spec_endpoint_path VARCHAR(255);
UPDATE exercise_service_info
SET public_spec_endpoint_path = ''
WHERE public_spec_endpoint_path IS NULL;
ALTER TABLE exercise_service_info
ALTER COLUMN public_spec_endpoint_path
SET NOT NULL;
COMMENT ON COLUMN exercise_service_info.public_spec_endpoint_path IS 'URL to an endpoint that will generate the public spec for an exercise service from respective private spec.';
COMMENT ON COLUMN exercise_service_info.submission_iframe_path IS 'URL to the iframe where an exercise submission can be viewed.';
