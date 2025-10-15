-- Add up migration script here
CREATE TABLE chatbot_configurations_models (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model VARCHAR(255) NOT NULL,
  thinking BOOLEAN NOT NULL,
  deployment_name VARCHAR(255) NOT NULL,
  default_model BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (id, thinking)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_configurations_models FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX chatbot_configurations_models_only_one_default ON chatbot_configurations_models (default_model, deleted_at) NULLS NOT DISTINCT
WHERE default_model IS TRUE;

COMMENT ON TABLE chatbot_configurations_models IS 'Stores Azure OpenAI LLMs that have been deployed in Azure AI. The chatbot_configurations table references this table to indicate which LLM the configuration uses.';
COMMENT ON COLUMN chatbot_configurations_models.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_configurations_models.model IS 'The model name of the LLM. Used for indicating which OpenAI model is in question.';
COMMENT ON COLUMN chatbot_configurations_models.deployment_name IS 'The name given to the LLM deployment in Azure. Used to access the correct Azure chatbot api endpoint.';
COMMENT ON COLUMN chatbot_configurations_models.default_model IS 'The default model to use on new chatbot_configurations.';
COMMENT ON COLUMN chatbot_configurations_models.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_configurations_models.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_configurations_models.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';


CREATE TYPE reasoning_effort_level AS ENUM ('minimal', 'low', 'medium', 'high');
CREATE TYPE verbosity_level AS ENUM ('low', 'medium', 'high');


ALTER TABLE chatbot_configurations
ADD COLUMN model UUID REFERENCES chatbot_configurations_models(id) ON DELETE CASCADE,
  ADD COLUMN thinking_model BOOLEAN,
  ADD CONSTRAINT thinking_model_constraint FOREIGN KEY (model, thinking_model) REFERENCES chatbot_configurations_models (id, thinking);

ALTER TABLE chatbot_configurations
ADD COLUMN max_completion_tokens INT CHECK (
    (max_completion_tokens IS NOT NULL) = thinking_model
  ),
  ADD COLUMN max_output_tokens INT CHECK (
    (max_output_tokens IS NOT NULL) = thinking_model
  ),
  ADD COLUMN verbosity verbosity_level CHECK ((verbosity IS NOT NULL) = thinking_model),
  ADD COLUMN reasoning_effort reasoning_effort_level CHECK ((reasoning_effort IS NOT NULL) = thinking_model),
  ALTER COLUMN temperature DROP NOT NULL,
  ADD CONSTRAINT a CHECK ((temperature IS NULL) = thinking_model),
  ALTER COLUMN top_p DROP NOT NULL,
  ADD CONSTRAINT b CHECK ((top_p IS NULL) = thinking_model),
  ALTER COLUMN frequency_penalty DROP NOT NULL,
  ADD CONSTRAINT c CHECK ((frequency_penalty IS NULL) = thinking_model),
  ALTER COLUMN presence_penalty DROP NOT NULL,
  ADD CONSTRAINT d CHECK ((presence_penalty IS NULL) = thinking_model),
  ALTER COLUMN response_max_tokens DROP NOT NULL,
  ADD CONSTRAINT e CHECK ((response_max_tokens IS NULL) = thinking_model);

COMMENT ON COLUMN chatbot_configurations.model IS 'The LLM to use in this chatbot configuration. The model choice affects the some of the behaviour of the chatbot.';
COMMENT ON COLUMN chatbot_configurations.max_completion_tokens IS 'The max. number of tokens the thinking LLM is allowed to use in generating the response, including output tokens and reasoning tokens.';
COMMENT ON COLUMN chatbot_configurations.max_output_tokens IS 'The maximum number of tokens the chatbot can output in a response, i.e. maximum response length in tokens.';
-- IF YOU update the response_max_tokens comment, then the same field could be used for both models.
COMMENT ON COLUMN chatbot_configurations.verbosity IS 'Verbosity of the generated response, with a higher level meaning that the model is more likely to generate longer responses and vice versa.';
COMMENT ON COLUMN chatbot_configurations.reasoning_effort IS 'Controls the amount of effort (time, tokens) used in the reasoning phase of response generations. A lower level means the model is more likely to use less tokens in reasoning (thinking). A low reasoning effort level will likely negatively affect how successful the model is in tasks that require complicated planning, reasoning, or complicated tool use.';

-- delete this ----------------------------------------------------------------
INSERT INTO chatbot_configurations_models (
    id,
    model,
    thinking,
    deployment_name,
    default_model
  )
VALUES (
    '22ba6c35-7e71-4c1d-ae26-5cf94201a6ee',
    'gpt-4o',
    FALSE,
    'gpt-4o',
    TRUE
  );

UPDATE chatbot_configurations
SET model = '22ba6c35-7e71-4c1d-ae26-5cf94201a6ee',
  thinking_model = FALSE
WHERE TRUE;

-----------------------------------------------------------------------------
ALTER TABLE chatbot_configurations
ALTER COLUMN model
SET NOT NULL,
  ALTER COLUMN thinking_model
SET NOT NULL;
