ALTER TABLE exercise_service_info
ADD COLUMN produces_file_answers BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exercise_service_info.produces_file_answers IS 'Whether this service declares that its answers consist of uploaded files rather than JSON. Independent of supports_native_client, which is about the client that answers rather than the shape of the answer.';
