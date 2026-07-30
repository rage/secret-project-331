ALTER TABLE exercise_service_info
ADD COLUMN build_user_answer_endpoint_path TEXT;

COMMENT ON COLUMN exercise_service_info.build_user_answer_endpoint_path IS 'Path to the endpoint that turns host-stored uploaded files into this service''s UserAnswer. Null when the service does not support native (non-browser) clients; the exercise-services client API serves only services that declare it.';
