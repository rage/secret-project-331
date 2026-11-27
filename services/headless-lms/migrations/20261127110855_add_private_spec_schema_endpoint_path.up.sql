ALTER TABLE exercise_service_info
ADD COLUMN private_spec_schema_endpoint_path TEXT;
COMMENT ON COLUMN exercise_service_info.private_spec_schema_endpoint_path IS 'Where the service serves the JSON Schema of its private specs, which agents validate the specs they write against. Optional.';
