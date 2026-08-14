-- Nothing else may go in this migration: sqlx wraps a migration in a transaction, and Postgres
-- refuses to use an enum value that was added in the transaction still open.
-- IF NOT EXISTS because the down migration cannot remove the label, so a revert leaves it behind
-- and re-applying would otherwise fail.
ALTER TYPE tool_kind
ADD VALUE IF NOT EXISTS 'client-tool';

COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_kind IS 'Who answers the call: server code for a function tool, the provider for an Azure AI Search tool, the client for a client tool.';

COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_kind IS 'Who answered the call: server code for a function tool, the provider for an Azure AI Search tool, the client for a client tool.';
