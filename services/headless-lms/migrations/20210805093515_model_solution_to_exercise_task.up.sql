-- Add up migration script here
ALTER TABLE exercise_tasks
ADD COLUMN model_solution_spec JSONB;
