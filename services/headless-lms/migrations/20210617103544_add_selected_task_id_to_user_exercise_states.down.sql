-- Add down migration script here
ALTER TABLE user_exercise_states DROP COLUMN selected_exercise_task_id;
