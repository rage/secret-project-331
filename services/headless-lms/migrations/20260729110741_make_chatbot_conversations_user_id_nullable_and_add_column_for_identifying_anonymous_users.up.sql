-- Add up migration script here
ALTER TABLE chatbot_conversations
ADD COLUMN anonymous_id UUID;

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id DROP NOT NULL;
