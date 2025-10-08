-- Add up migration script here
CREATE TABLE chatbot_configurations_models (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  model VARCHAR(255) NOT NULL,
  deployment_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_configurations_models FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_configurations_models IS 'Stores Azure OpenAI LLMs that have been deployed in Azure AI. The chatbot_configurations table references this table to indicate which LLM the configuration uses.';
COMMENT ON COLUMN chatbot_configurations_models.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_configurations_models.model IS 'The model name of the LLM. Used for indicating which OpenAI model is in question.';
COMMENT ON COLUMN chatbot_configurations_models.deployment_name IS 'The name given to the LLM deployment in Azure. Used to access the correct Azure chatbot api endpoint.';
COMMENT ON COLUMN chatbot_configurations_models.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_configurations_models.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_configurations_models.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
-- description column?
INSERT INTO chatbot_configurations_models (id, model, deployment_name)
VALUES (
    '22ba6c35-7e71-4c1d-ae26-5cf94201a6ee',
    'gpt-4o',
    'gpt-4o'
  );

ALTER TABLE chatbot_configurations
ADD COLUMN model UUID REFERENCES chatbot_configurations_models(id) ON DELETE CASCADE;

COMMENT ON COLUMN chatbot_configurations.model IS 'The LLM to use in this chatbot configuration. The model choice affects the some of the behaviour of the chatbot.';

UPDATE chatbot_configurations
SET model = '22ba6c35-7e71-4c1d-ae26-5cf94201a6ee'
WHERE TRUE;

ALTER TABLE chatbot_configurations
ALTER COLUMN model
SET NOT NULL;
