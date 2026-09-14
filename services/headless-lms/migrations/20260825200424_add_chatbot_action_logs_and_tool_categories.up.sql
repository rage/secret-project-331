CREATE TABLE chatbot_action_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  acting_user_id UUID NOT NULL REFERENCES users (id),
  tool_call_id UUID NOT NULL REFERENCES chatbot_conversation_message_tool_calls (id),
  tool_name VARCHAR(255) NOT NULL,
  arguments JSONB NOT NULL,
  target_user_id UUID REFERENCES users (id),
  course_id UUID REFERENCES courses (id),
  summary TEXT NOT NULL
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_action_logs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX chatbot_action_logs_target_user ON chatbot_action_logs (target_user_id)
WHERE deleted_at IS NULL;
CREATE INDEX chatbot_action_logs_acting_user ON chatbot_action_logs (acting_user_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE chatbot_action_logs IS 'Audit trail of privileged mutations a support chatbot admin confirmed and the server executed. Distinct from any per-domain log (e.g. exercise_reset_logs): this answers "what did admins do via chatbots", the domain log answers "what happened to this row".';
COMMENT ON COLUMN chatbot_action_logs.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_action_logs.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_action_logs.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_action_logs.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_action_logs.acting_user_id IS 'The admin who confirmed the action.';
COMMENT ON COLUMN chatbot_action_logs.tool_call_id IS 'The confirmed tool call that produced this action.';
COMMENT ON COLUMN chatbot_action_logs.tool_name IS 'Wire name of the action tool that was executed.';
COMMENT ON COLUMN chatbot_action_logs.arguments IS 'The tool call arguments the model supplied. Must never contain secrets: record what was done, not tokens or links produced by doing it.';
COMMENT ON COLUMN chatbot_action_logs.target_user_id IS 'The user the action affected, if any.';
COMMENT ON COLUMN chatbot_action_logs.course_id IS 'The course the action was scoped to, if any.';
COMMENT ON COLUMN chatbot_action_logs.summary IS 'One human-readable sentence describing what the action did. Must never contain secrets.';

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
