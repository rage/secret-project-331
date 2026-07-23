-- Add up migration script here
ALTER TABLE chatbot_conversations
ALTER COLUMN course_id DROP NOT NULL;
