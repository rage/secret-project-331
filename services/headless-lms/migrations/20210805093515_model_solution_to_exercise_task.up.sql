-- Add up migration script here
ALTER TABLE exercise_tasks
ADD COLUMN model_solution_spec JSONB;
COMMENT ON COLUMN exercise_tasks.model_solution_spec IS 'Defines what are the correct solutions for the exercise';
