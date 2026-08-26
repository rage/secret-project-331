CREATE TYPE chatbot_tool_category AS ENUM (
  'course_material',
  'course_info',
  'course_catalog',
  'interaction',
  'admin_support_accounts',
  'admin_support_courses',
  'admin_support_learning_progress',
  'admin_support_academic_integrity'
);

ALTER TABLE chatbot_configurations
ADD COLUMN enabled_tool_categories chatbot_tool_category[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN chatbot_configurations.enabled_tool_categories IS 'Which categories of tools this chatbot offers the LLM. Values are ToolCategory in the Rust code; a tool is offered only if its category is listed here and the caller holds the tool''s own permission.';

UPDATE chatbot_configurations
SET enabled_tool_categories = ARRAY['course_material', 'course_info', 'course_catalog', 'interaction']::chatbot_tool_category[]
WHERE use_tools = TRUE;

ALTER TABLE chatbot_configurations
DROP COLUMN use_tools;
