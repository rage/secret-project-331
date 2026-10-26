ALTER TABLE chatbot_configurations
ADD CONSTRAINT course_id_and_publicly_accessible_not_both_set CHECK (
    (publicly_accessible IS TRUE) <> (course_id IS NOT NULL)
  );

ALTER TABLE chatbot_configurations DROP COLUMN embeddable;
