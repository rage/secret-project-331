-- Add down migration script here
ALTER TABLE chatbot_configurations DROP COLUMN model,
  DROP COLUMN max_completion_tokens,
  DROP COLUMN max_output_tokens,
  DROP COLUMN verbosity,
  DROP COLUMN reasoning_effort,
  DROP COLUMN thinking_model,
  --DROP CONSTRAINT thinking_model_constraint,
ALTER COLUMN response_max_tokens
SET NOT NULL,
  ALTER COLUMN temperature
SET NOT NULL,
  ALTER COLUMN top_p
SET NOT NULL,
  ALTER COLUMN presence_penalty
SET NOT NULL,
  ALTER COLUMN frequency_penalty
SET NOT NULL;

DROP TABLE chatbot_configurations_models;

DROP TYPE reasoning_effort_level;
DROP TYPE verbosity_level;
