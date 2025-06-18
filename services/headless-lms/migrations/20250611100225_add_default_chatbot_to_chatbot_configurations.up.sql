ALTER TABLE chatbot_configurations
ADD COLUMN default_chatbot boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chatbot_configurations.default_chatbot IS 'If true, this is the chatbot that is accessible from the balloon on the corner of the course material. If false, this can be some other chatbot related to the course, such as a chatbot visible within the text of the course material.';

ALTER TABLE chatbot_configurations DROP CONSTRAINT chatbot_configurations_course_id_deleted_at_key;
CREATE UNIQUE INDEX chatbot_configurations_only_one_default ON chatbot_configurations (course_id, deleted_at) NULLS NOT DISTINCT
WHERE default_chatbot IS TRUE;
