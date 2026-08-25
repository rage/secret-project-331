ALTER TABLE exercise_service_info
ADD COLUMN supports_native_client BOOLEAN NOT NULL DEFAULT FALSE;

-- Derived before the drop so the client API keeps serving the same services across the migration,
-- rather than serving none until service-info-fetcher next re-fetches every service.
UPDATE exercise_service_info
SET supports_native_client = TRUE
WHERE build_user_answer_endpoint_path IS NOT NULL;

ALTER TABLE exercise_service_info DROP COLUMN build_user_answer_endpoint_path;

COMMENT ON COLUMN exercise_service_info.supports_native_client IS 'Whether this service declares that it can be answered from a native (non-browser) client. Gates the exercise-services client API: it serves only services that declare it.';
