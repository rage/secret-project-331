-- restore old reasoning effort
ALTER TYPE reasoning_effort_level
RENAME TO reasoning_effort_level_old;

CREATE TYPE reasoning_effort_level AS ENUM ('minimal', 'low', 'medium', 'high');

UPDATE chatbot_configurations
SET reasoning_effort = 'minimal'::reasoning_effort_level_old
WHERE reasoning_effort = 'none'::reasoning_effort_level_old;
UPDATE chatbot_configurations
SET reasoning_effort = 'high'::reasoning_effort_level_old
WHERE reasoning_effort = 'xhigh'::reasoning_effort_level_old;

ALTER TABLE chatbot_configurations
ALTER COLUMN reasoning_effort DROP DEFAULT,
  ALTER COLUMN reasoning_effort TYPE reasoning_effort_level USING reasoning_effort::text::reasoning_effort_level,
  ALTER COLUMN reasoning_effort
SET DEFAULT 'low'::reasoning_effort_level;
DROP TYPE reasoning_effort_level_old;

-- restore thinking and thinking_model
ALTER TABLE chatbot_configurations_models
ADD COLUMN thinking BOOLEAN;

UPDATE chatbot_configurations_models
SET thinking = FALSE
WHERE TRUE;
UPDATE chatbot_configurations_models
SET thinking = TRUE
WHERE model_type IN ('gpt-thinking', 'gpt-hard-thinking');
ALTER TABLE chatbot_configurations_models
ALTER COLUMN thinking
SET NOT NULL,
  ADD CONSTRAINT chatbot_configurations_models_id_thinking_key UNIQUE (id, thinking);

ALTER TABLE chatbot_configurations
ADD COLUMN thinking_model BOOLEAN;

UPDATE chatbot_configurations
SET thinking_model = FALSE
WHERE TRUE;

UPDATE chatbot_configurations
SET thinking_model = TRUE
WHERE model_id IN (
    SELECT id
    FROM chatbot_configurations_models
    WHERE model_type = 'gpt-thinking'
      OR model_type = 'gpt-hard-thinking'
  );

ALTER TABLE chatbot_configurations
ALTER COLUMN thinking_model
SET NOT NULL,
  ADD CONSTRAINT chatbot_configurations_models_fk FOREIGN KEY (model_id, thinking_model) REFERENCES chatbot_configurations_models (id, thinking);


-- remove model_type and mistral models
UPDATE chatbot_configurations
SET model_id = (
    SELECT id
    FROM chatbot_configurations_models
    WHERE default_model = TRUE
    LIMIT 1
  )
WHERE model_id IN (
    SELECT id
    FROM chatbot_configurations_models
    WHERE model_type = 'mistral'
  );

ALTER TABLE chatbot_configurations_models DROP COLUMN model_type;
DROP TYPE model_type;
ALTER TABLE chatbot_configurations
ALTER COLUMN use_semantic_reranking
SET DEFAULT FALSE;
