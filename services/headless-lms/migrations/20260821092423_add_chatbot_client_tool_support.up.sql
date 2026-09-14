-- Nothing in this migration may use the new label as a value: sqlx wraps a migration in a
-- transaction, and Postgres refuses to use an enum value added in the transaction still open.
-- IF NOT EXISTS because the down migration cannot remove the label, so a revert leaves it behind
-- and re-applying would otherwise fail.
ALTER TYPE tool_kind
ADD VALUE IF NOT EXISTS 'client-tool';

COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_kind IS 'Who answers the call: server code for a function tool, the provider for an Azure AI Search tool, the client for a client tool.';

COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_kind IS 'Who answered the call: server code for a function tool, the provider for an Azure AI Search tool, the client for a client tool.';

ALTER TABLE chatbot_conversation_message_tool_outputs
ADD COLUMN client_answer JSONB;

COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.client_answer IS 'The answer payload the client sent for a client tool call, in the shape that tool defines. Null for outputs that no client answered, such as server-side tools and aborted calls.';

ALTER TABLE chatbot_conversation_message_reasoning
ADD COLUMN encrypted_content TEXT;

COMMENT ON COLUMN chatbot_conversation_message_reasoning.encrypted_content IS 'Opaque reasoning payload from Azure, sent back on later turns so the model keeps its own reasoning. Null for rows written while responses were still stored on the Azure side and replayed by id.';

-- get_latest_conversation_for_user matches one of two owner columns, so the OR takes an index
-- each; created_at last lets its newest-first LIMIT 1 be read straight off the index.
CREATE INDEX chatbot_conversations_config_user_created_at_idx ON chatbot_conversations (chatbot_configuration_id, user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX chatbot_conversations_config_anonymous_token_created_at_idx ON chatbot_conversations (
  chatbot_configuration_id,
  anonymous_token,
  created_at DESC
)
WHERE deleted_at IS NULL;

CREATE INDEX chatbot_conversation_message_messages_message_id_idx ON chatbot_conversation_message_messages (chatbot_conversation_message_id);

CREATE INDEX chatbot_conversation_message_tool_calls_message_id_idx ON chatbot_conversation_message_tool_calls (chatbot_conversation_message_id);

CREATE INDEX chatbot_conversation_message_tool_calls_tool_call_id_idx ON chatbot_conversation_message_tool_calls (tool_call_id);

CREATE INDEX chatbot_conversation_message_tool_outputs_message_id_idx ON chatbot_conversation_message_tool_outputs (chatbot_conversation_message_id);

CREATE INDEX chatbot_conversation_message_tool_outputs_tool_call_id_idx ON chatbot_conversation_message_tool_outputs (tool_call_id);

CREATE INDEX chatbot_conversation_message_reasoning_message_id_idx ON chatbot_conversation_message_reasoning (chatbot_conversation_message_id);
