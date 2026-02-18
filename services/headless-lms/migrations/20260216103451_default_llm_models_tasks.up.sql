CREATE TYPE application_task AS ENUM ('content-cleaning', 'message-suggestion');

CREATE TABLE application_task_default_language_models (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  task application_task NOT NULL,
  model_id UUID NOT NULL REFERENCES chatbot_configurations_models(id),
  context_utilization real NOT NULL CONSTRAINT valid_context_utilization CHECK (
    context_utilization > 0.0
    AND context_utilization < 1.0
  ),
  UNIQUE NULLS NOT DISTINCT (task, deleted_at)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON application_task_default_language_models FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE application_task_default_language_models IS 'Info about the model and context utilization for LLMs to be used in application tasks, like cleaning course material content and generating chatbot suggested messages.';
COMMENT ON COLUMN application_task_default_language_models.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN application_task_default_language_models.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN application_task_default_language_models.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN application_task_default_language_models.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN application_task_default_language_models.task IS 'The task that the settings in this record are associated with.';
COMMENT ON COLUMN application_task_default_language_models.model_id IS 'The id of the LLM model that is associated with the task specified in this record.';
COMMENT ON COLUMN application_task_default_language_models.context_utilization IS 'The fraction of the LLMs context size to be utilized. Filling the whole context can have a negative effect on the model`s performance. The best fraction to choose depends on the model and the task.';

ALTER TABLE chatbot_configurations_models
ADD COLUMN context_size integer NOT NULL DEFAULT 16000;

COMMENT ON COLUMN chatbot_configurations_models.context_size IS 'The length of the LLMs context window in tokens.';
