-- Add up migration script here
ALTER TABLE user_exercise_states
ADD COLUMN selected_exercise_task_id UUID REFERENCES exercise_tasks;
