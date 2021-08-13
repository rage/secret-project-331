-- Add up migration script here
-- Add up migration script here
DELETE FROM exercise_service_info;
ALTER TABLE exercise_service_info
ADD COLUMN model_solution_path VARCHAR(255) NOT NULL;
ALTER TABLE exercise_service_info
ADD CONSTRAINT exercise_service_info_check_model_solution_path_not_empty CHECK (TRIM(model_solution_path) <> '');
COMMENT ON COLUMN exercise_service_info.model_solution_path IS 'URL to an endpoint that will generate model solutions';