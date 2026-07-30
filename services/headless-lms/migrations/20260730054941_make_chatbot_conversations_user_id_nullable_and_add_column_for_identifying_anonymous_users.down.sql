-- Add down migration script here
ALTER TABLE chatbot_conversations DROP CONSTRAINT user_id_or_anonymous_id_set;

ALTER TABLE chatbot_conversations DROP COLUMN anonymous_id;

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id
SET NOT NULL;
