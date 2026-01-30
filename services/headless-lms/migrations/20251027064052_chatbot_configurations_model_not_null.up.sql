ALTER TABLE chatbot_configurations
ALTER COLUMN model
SET NOT NULL,
  ALTER COLUMN thinking_model
SET NOT NULL;

ALTER TABLE chatbot_configurations
  RENAME COLUMN model TO model_id;
