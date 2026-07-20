-- Add up migration script here
ALTER TYPE reasoning_effort_level
ADD VALUE 'none' BEFORE 'minimal';
ALTER TYPE reasoning_effort_level
ADD VALUE 'xhigh'
AFTER 'high';

CREATE TYPE model_type AS ENUM (
  'gpt-thinking',
  'gpt-non-thinking',
  'gpt-hard-thinking',
  'mistral'
);

ALTER TABLE chatbot_configurations_models
ADD COLUMN model_type model_type;
--set not null later
UPDATE chatbot_configurations_models
SET model_type = 'gpt-non-thinking'::model_type
WHERE TRUE;
UPDATE chatbot_configurations_models
SET model_type = 'gpt-thinking'::model_type
WHERE model LIKE '%-5%';
ALTER TABLE chatbot_configurations_models
ALTER COLUMN model_type
SET NOT NULL;

COMMENT ON COLUMN chatbot_configurations_models.model_type IS 'The model type tells which parameters the model accepts, for example parameters related to reasoning.';

ALTER TABLE chatbot_configurations DROP COLUMN thinking_model;
ALTER TABLE chatbot_configurations_models DROP COLUMN thinking;
ALTER TABLE chatbot_configurations
ALTER COLUMN use_semantic_reranking
SET DEFAULT TRUE;
