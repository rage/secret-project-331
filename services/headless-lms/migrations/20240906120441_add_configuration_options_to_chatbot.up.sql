ALTER TABLE chatbot_configurations
ADD COLUMN include_current_page_in_messages BOOLEAN DEFAULT TRUE NOT NULL;
COMMENT ON COLUMN chatbot_configurations.include_current_page_in_messages IS 'Whether to include the current page content as context when asking stuff from the chatbot.';
