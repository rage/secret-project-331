-- modify message_role enum
ALTER TYPE message_role
RENAME VALUE 'tool' TO 'developer';

-- to be compatible with the v1 api
CREATE TABLE chatbot_conversation_message_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  chatbot_conversation_message_id UUID NOT NULL REFERENCES chatbot_conversation_messages(id),
  message_role message_role NOT NULL,
  message_is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  text VARCHAR(131072) NOT NULL,
  used_tokens INT NOT NULL DEFAULT 0,
  citation_ids UUID []
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_message_messages FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_message_messages IS '';
COMMENT ON COLUMN chatbot_conversation_message_messages.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_messages.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_messages.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_messages.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_conversation_message_messages.chatbot_conversation_message_id IS 'The chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_messages.message_role IS 'The role of the message: is it from the user or the chatbot.';
COMMENT ON COLUMN chatbot_conversation_message_messages.message_is_complete IS 'Always true for messages from the user. The chatbot messages are streamed to the client, and this field is used to indicate whether that the stream is complete.';

COMMENT ON COLUMN chatbot_conversation_message_messages.text IS 'The message content.';
COMMENT ON COLUMN chatbot_conversation_message_messages.used_tokens IS 'The number of tokens used to send or receive this message. Is non-zero only for role user messages, which track all the tokens used for input, reasoning, and output.';
COMMENT ON COLUMN chatbot_conversation_message_messages.citation_ids IS 'IDs of any citations (annotations) that are associated with this message. A role assistant message can cite course material.';


CREATE TABLE chatbot_conversation_message_reasoning (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  chatbot_conversation_message_id UUID NOT NULL REFERENCES chatbot_conversation_messages(id),
  summary VARCHAR(131072)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_message_reasoning FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_message_reasoning IS '';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.chatbot_conversation_message_id IS 'The chatbot_conversation_message that this row belongs to.';
COMMENT ON COLUMN chatbot_conversation_message_reasoning.summary IS 'A summary of the reasoning process, if provided.';

CREATE TYPE tool_kind AS ENUM ('function', 'azure-ai-search');

ALTER TABLE chatbot_conversation_message_tool_calls
ADD COLUMN tool_kind tool_kind NOT NULL DEFAULT 'function'::tool_kind;
ALTER TABLE chatbot_conversation_message_tool_calls
  RENAME COLUMN message_id TO chatbot_conversation_message_id;

COMMENT ON COLUMN chatbot_conversation_message_tool_calls.tool_kind IS 'The kind of the tool: is it a function tool or Azure AI Search tool.';

ALTER TABLE chatbot_conversation_message_tool_outputs
ADD COLUMN tool_kind tool_kind NOT NULL DEFAULT 'function'::tool_kind;
ALTER TABLE chatbot_conversation_message_tool_outputs
  RENAME COLUMN message_id TO chatbot_conversation_message_id;
ALTER TABLE chatbot_conversation_message_tool_outputs
  RENAME COLUMN tool_output TO output;

COMMENT ON COLUMN chatbot_conversation_message_tool_outputs.tool_kind IS 'The kind of the tool: is it a function tool or Azure AI Search tool.';

-- move data from ccm to new tables
INSERT INTO chatbot_conversation_message_messages (
    chatbot_conversation_message_id,
    message_role,
    text,
    used_tokens,
    created_at,
    updated_at,
    deleted_at
  )
SELECT id,
  message_role,
  message,
  used_tokens,
  created_at,
  updated_at,
  deleted_at
FROM chatbot_conversation_messages
WHERE chatbot_conversation_messages.message_role IN ('user'::message_role, 'assistant'::message_role)
  AND chatbot_conversation_messages.id NOT IN (
    SELECT chatbot_conversation_message_id
    FROM chatbot_conversation_message_tool_calls
  );

ALTER TABLE chatbot_conversation_messages DROP COLUMN message,
  DROP COLUMN message_role,
  DROP COLUMN tool_output_id,
  DROP COLUMN used_tokens,
  DROP COLUMN message_is_complete;
