ALTER TABLE chatbot_configurations
ADD COLUMN max_completion_tokens INT NOT NULL DEFAULT 600,
  ADD COLUMN response_max_tokens INT NOT NULL DEFAULT 500;

UPDATE chatbot_configurations
SET response_max_tokens = max_output_tokens
WHERE thinking_model = FALSE;

UPDATE chatbot_configurations
SET max_completion_tokens = max_output_tokens
WHERE thinking_model = TRUE;

ALTER TABLE chatbot_configurations DROP COLUMN max_output_tokens;


COMMENT ON COLUMN chatbot_configurations.response_max_tokens IS 'The maximum number of tokens the chatbot can output in a response, i.e. maximum response length in tokens. Only used with non-reasoning models.';
COMMENT ON COLUMN chatbot_configurations.max_completion_tokens IS 'The max. number of tokens the thinking LLM is allowed to use in generating the response, including output tokens and reasoning tokens. Only used with reasoning models.';
