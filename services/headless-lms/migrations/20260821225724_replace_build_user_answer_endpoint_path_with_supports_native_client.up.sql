ALTER TABLE exercise_service_info DROP COLUMN build_user_answer_endpoint_path;

ALTER TABLE exercise_service_info
ADD COLUMN supports_native_client BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN exercise_service_info.supports_native_client IS 'Whether this service declares that it can be answered from a native (non-browser) client. Gates the exercise-services client API: it serves only services that declare it.';
