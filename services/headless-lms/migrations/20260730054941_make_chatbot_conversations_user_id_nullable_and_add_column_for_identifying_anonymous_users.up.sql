-- Add up migration script here
ALTER TABLE chatbot_conversations
ADD COLUMN anonymous_id VARCHAR(255);

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE chatbot_conversations
ADD CONSTRAINT user_id_or_anonymous_id_set CHECK ((user_id IS NULL) <> (anonymous_id IS NULL));
