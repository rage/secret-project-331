-- Add up migration script here
ALTER TABLE exercise_service_info
ADD has_custom_view BOOLEAN NOT NULL DEFAULT FALSE;
-- UPDATE exercise_service_info
-- SET has_custom_view = FALSE;
