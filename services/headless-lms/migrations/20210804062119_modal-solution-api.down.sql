-- Add down migration script here
COMMENT ON COLUMN exercise_service_info.model_solution_path IS NULL;
ALTER TABLE exercise_service_info DROP COLUMN model_solution_path;