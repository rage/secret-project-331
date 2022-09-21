-- Add down migration script here
ALTER TABLE exercise_tasks
ADD spec_file_id UUID;
