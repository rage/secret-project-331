-- Add down migration script here
ALTER TABLE chatbot_conversations DROP COLUMN anonymous_id;

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id
SET NOT NULL;
