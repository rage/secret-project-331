ALTER TABLE chatbot_configurations DROP COLUMN model,
  DROP COLUMN max_completion_tokens,
  DROP COLUMN verbosity,
  DROP COLUMN reasoning_effort,
  DROP COLUMN thinking_model;

DROP TABLE chatbot_configurations_models;

DROP TYPE reasoning_effort_level;
DROP TYPE verbosity_level;
