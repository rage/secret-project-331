ALTER TABLE chatbot_configurations
ADD COLUMN embeddable BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN chatbot_configurations.embeddable IS 'Tells whether the chatbot should be embeddable in an iframe or not.';

ALTER TABLE chatbot_configurations DROP CONSTRAINT course_id_and_publicly_accessible_not_both_set;
