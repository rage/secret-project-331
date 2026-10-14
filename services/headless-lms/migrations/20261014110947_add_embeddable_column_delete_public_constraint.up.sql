ALTER TABLE chatbot_configurations
ADD COLUMN embeddable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE chatbot_configurations DROP CONSTRAINT course_id_and_publicly_accessible_not_both_set;
