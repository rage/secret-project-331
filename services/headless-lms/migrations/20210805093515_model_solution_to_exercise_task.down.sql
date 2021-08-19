-- Add down migration script here
ALTER TABLE exercise_tasks DROP COLUMN model_solution_spec;
