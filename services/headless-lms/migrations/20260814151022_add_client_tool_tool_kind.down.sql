-- Postgres cannot remove an enum value, so the label stays behind unused. What the revert has to
-- undo is the data: code without the variant cannot read a 'client-tool' row at all, so those rows
-- become function calls, which its unanswered-tool-call sweep then repairs.
UPDATE chatbot_conversation_message_tool_calls
SET tool_kind = 'function'
WHERE tool_kind = 'client-tool';

UPDATE chatbot_conversation_message_tool_outputs
SET tool_kind = 'function'
WHERE tool_kind = 'client-tool';

COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_kind IS 'The kind of the tool: is it a function tool or Azure AI Search tool.';

COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_kind IS 'The kind of the tool: is it a function tool or Azure AI Search tool.';
