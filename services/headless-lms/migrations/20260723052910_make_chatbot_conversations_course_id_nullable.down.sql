-- Add down migration script here
ALTER TABLE chatbot_conversations
ALTER COLUMN course_id
SET NOT NULL;
