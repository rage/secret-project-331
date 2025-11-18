CREATE TYPE message_role_type AS ENUM ('user', 'assistant', 'tool');

CREATE TABLE chatbot_conversation_message_tool_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES chatbot_conversation_messages NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  tool_arguments VARCHAR(255) NOT NULL,
  tool_call_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
);

COMMENT ON TABLE chatbot_conversation_message_tool_calls IS 'Fields related to a chatbot_conversation_messages row that is a message from the chatbot and contains chatbot tool calls.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.message_id IS 'The ID of the chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_name IS 'The name of the chatbot tool that was called.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_arguments IS 'A JSON string that contains the arguments passed to the chatbot tool.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_call_id IS 'The ID of the specific tool call, created by Azure and needed to connect a tool result to the correct tool call.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_tool_calls.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';



CREATE TABLE chatbot_conversation_message_tool_outputs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES chatbot_conversation_messages NOT NULL,
  tool_name VARCHAR(255) NOT NULL,
  tool_output VARCHAR(255) NOT NULL,
  tool_call_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
);

COMMENT ON TABLE chatbot_conversation_message_tool_outputs IS 'Fields related to a chatbot_conversation_messages row that is a message with the role "tool" and contains tool output information. Tool call outputs are individual messages in the chatbot_conversation.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.message_id IS 'The ID of the chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_name IS 'The name of the chatbot tool that was called.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_output IS 'The result returned from the tool, a string. Is sent to the chatbot.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_call_id IS 'The ID of the specific tool call, created by Azure and needed to connect a tool result to the correct tool call.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';



ALTER TABLE chatbot_conversation_messages
ALTER COLUMN is_from_chatbot TYPE message_role_type USING CASE
    WHEN is_from_chatbot = TRUE THEN 'assistant'
    ELSE 'user'
  END;
ALTER TABLE chatbot_conversation_messages
  RENAME COLUMN is_from_chatbot TO message_role;
ALTER TABLE chatbot_conversation_messages
ADD COLUMN tool_output_id UUID REFERENCES chatbot_conversation_message_tool_outputs CONSTRAINT tool_result_message CHECK (
    NOT NULL tool_output_id
    AND message_role = 'tool'
  ),
  ADD COLUMN tool_call_id UUID REFERENCES chatbot_conversation_message_tool_calls CONSTRAINT chatbot_tool_call_message (
    NOT NULL tool_call_id
    AND message_role = 'assistant'
  );

COMMENT ON COLUMN chatbot_conversation_messages.message_role IS "The role of the message, is it from the user or the chatbot, or does it contain chatbot tool call output.";
COMMENT ON COLUMN chatbot_conversation_messages.tool_output_id IS "If this message is a role 'tool' message that contains tool output, this column is set.";
COMMENT ON COLUMN chatbot_conversation_messages.tool_call_id IS "If this message is a role 'assistant' (chatbot) message that contains tool calls, this column is set.";
