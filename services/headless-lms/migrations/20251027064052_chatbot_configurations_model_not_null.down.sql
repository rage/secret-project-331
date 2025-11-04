ALTER TABLE chatbot_configurations
ALTER COLUMN model_id DROP NOT NULL,
  ALTER COLUMN thinking_model DROP NOT NULL;

ALTER TABLE chatbot_configurations
  RENAME COLUMN model_id TO model;
