CREATE TYPE message_role AS ENUM ('user', 'assistant', 'tool');

CREATE TABLE chatbot_conversation_message_tool_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES chatbot_conversation_messages NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  tool_arguments JSONB NOT NULL,
  tool_call_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_message_tool_calls FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_message_tool_calls IS 'Contains tool calls made by the chatbot in a conversation. Each row is associated with a chatbot_conversation_messages row that has the role "assistant" in a many (tool calls) to one (message) relationship.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.message_id IS 'The chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_name IS 'The chatbot tool that was called.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_arguments IS 'A JSON object that contains the arguments passed to the chatbot tool.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_call_id IS 'The ID of the specific tool call, created by Azure and needed to connect a tool result to the correct tool call.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE chatbot_conversation_message_tool_outputs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES chatbot_conversation_messages NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  tool_output VARCHAR(32376) NOT NULL,
  tool_call_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_message_tool_outputs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_message_tool_outputs IS 'The results from a chatbot tool call. Associated one-to-one with chatbot_conversation_messages row with the role "tool".';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.message_id IS 'The chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_name IS 'The chatbot tool that was called.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_output IS 'The result returned from the tool, a string. Is sent to the chatbot.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_call_id IS 'The ID of the specific tool call, created by Azure and needed to connect a tool result to the correct tool call.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

-- Convert is_from_chatbot boolean column to a new message_role column
ALTER TABLE chatbot_conversation_messages
ADD COLUMN message_role message_role;
UPDATE chatbot_conversation_messages AS m
SET message_role = 'assistant'::message_role
WHERE m.is_from_chatbot = TRUE;
UPDATE chatbot_conversation_messages AS m
SET message_role = 'user'::message_role
WHERE m.is_from_chatbot = FALSE;
ALTER TABLE chatbot_conversation_messages
ALTER COLUMN message_role
SET NOT NULL,
  DROP COLUMN is_from_chatbot;

-- New columns for additional fields for tool call and tool result messages
ALTER TABLE chatbot_conversation_messages
ADD COLUMN tool_output_id UUID REFERENCES chatbot_conversation_message_tool_outputs CONSTRAINT is_tool_result_message CHECK (
    (
      message_role <> 'tool'::message_role
      AND tool_output_id IS NULL
    )
    OR (
      message_role = 'tool'::message_role
      AND message IS NULL
    )
  );
ALTER TABLE chatbot_conversation_messages
ADD CONSTRAINT is_user_message CHECK (
    (
      message_role = 'user'::message_role
      AND tool_output_id IS NULL
      AND message IS NOT NULL
    )
    OR (message_role <> 'user'::message_role)
  );

COMMENT ON COLUMN chatbot_conversation_messages.message_role IS 'The role of the message, is it from the user or the chatbot, or does it contain chatbot tool call output.';
COMMENT ON COLUMN chatbot_conversation_messages.tool_output_id IS 'If this message is a role "tool" message that contains tool output, this column is set. The corresponding row in chatbot_conversation_message_tool_outputs contains info about the tool call output.';
