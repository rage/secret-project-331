ALTER TABLE chatbot_configurations
ADD COLUMN max_output_tokens INT NOT NULL DEFAULT 600;

UPDATE chatbot_configurations
SET max_output_tokens = response_max_tokens
WHERE thinking_model = FALSE;

UPDATE chatbot_configurations
SET max_output_tokens = max_completion_tokens
WHERE thinking_model = TRUE;

ALTER TABLE chatbot_configurations DROP COLUMN response_max_tokens,
  DROP COLUMN max_completion_tokens;

COMMENT ON COLUMN chatbot_configurations.max_output_tokens IS 'The max. number of tokens the thinking LLM is allowed to use in generating the response, including tokens outputted in the response and hidden reasoning tokens. Should generally be larger with reasoning (thinking) models, and smaller with non-thinking models.';
