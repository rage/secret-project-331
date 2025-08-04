DROP INDEX chatbot_configurations_only_one_default;
ALTER TABLE chatbot_configurations DROP COLUMN default_chatbot;
ALTER TABLE chatbot_configurations
ADD CONSTRAINT chatbot_configurations_course_id_deleted_at_key UNIQUE NULLS NOT DISTINCT (course_id, deleted_at);
