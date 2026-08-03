-- Add up migration script here
ALTER TABLE chatbot_conversations
ADD COLUMN anonymous_token VARCHAR(255);

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE chatbot_conversations
ADD CONSTRAINT user_id_or_anonymous_token_set CHECK ((user_id IS NULL) <> (anonymous_token IS NULL));
