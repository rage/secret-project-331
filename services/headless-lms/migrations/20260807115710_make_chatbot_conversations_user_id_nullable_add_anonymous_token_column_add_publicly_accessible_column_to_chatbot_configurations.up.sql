ALTER TABLE chatbot_conversations
ADD COLUMN anonymous_token VARCHAR(255);

ALTER TABLE chatbot_conversations
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE chatbot_configurations
ADD COLUMN publicly_accessible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE chatbot_conversations
ADD CONSTRAINT user_id_or_anonymous_token_set CHECK ((user_id IS NULL) <> (anonymous_token IS NULL));

ALTER TABLE chatbot_configurations
ADD CONSTRAINT course_id_and_publicly_accessible_not_both_set CHECK (
    (publicly_accessible IS TRUE) <> (course_id IS NOT NULL)
  );
