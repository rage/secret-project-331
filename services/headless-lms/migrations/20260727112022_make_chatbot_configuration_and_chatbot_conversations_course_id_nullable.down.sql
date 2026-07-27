-- Add down migration script here
BEGIN;

ALTER TABLE chatbot_configurations
ALTER COLUMN course_id
SET NOT NULL;

ALTER TABLE chatbot_conversations
ALTER COLUMN course_id
SET NOT NULL;

COMMIT;
