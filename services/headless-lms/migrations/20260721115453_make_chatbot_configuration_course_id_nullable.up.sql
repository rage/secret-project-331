-- Add up migration script here
ALTER TABLE chatbot_configurations
ALTER COLUMN course_id DROP NOT NULL;
