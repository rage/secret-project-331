ALTER TABLE chatbot_configurations
ADD CONSTRAINT chatbot_configurations_max_output_tokens_min CHECK (max_output_tokens >= 150);
