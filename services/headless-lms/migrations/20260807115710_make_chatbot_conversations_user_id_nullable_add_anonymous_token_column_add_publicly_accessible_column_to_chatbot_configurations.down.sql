ALTER TABLE chatbot_conversations DROP CONSTRAINT user_id_or_anonymous_token_set;

ALTER TABLE chatbot_configurations DROP CONSTRAINT course_id_and_publicly_accessible_not_both_set;

ALTER TABLE chatbot_conversations DROP COLUMN anonymous_token;

ALTER TABLE chatbot_configurations DROP COLUMN publicly_accessible;

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id
SET NOT NULL;
