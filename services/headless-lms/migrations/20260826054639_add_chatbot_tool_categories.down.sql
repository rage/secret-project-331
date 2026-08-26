ALTER TABLE chatbot_configurations
ADD COLUMN use_tools BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE chatbot_configurations
SET use_tools = TRUE
WHERE enabled_tool_categories <> '{}';

ALTER TABLE chatbot_configurations
DROP COLUMN enabled_tool_categories;

DROP TYPE chatbot_tool_category;
