ALTER TABLE chatbot_configurations
ADD COLUMN use_tools BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chatbot_configurations.use_tools IS 'Control whether the chatbot is able to use tools (call functions) that we define and provide for it.';
