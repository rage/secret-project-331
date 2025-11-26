DROP TABLE chatbot_conversation_message_tool_calls;

-- delete role=assistant messages that don't have text content i.e. that have
-- tool calls associated with them
DELETE FROM chatbot_conversation_messages
WHERE message_role = 'assistant'::message_role
  AND message IS NULL;

-- delete role=tool messages
ALTER TABLE chatbot_conversation_messages DROP COLUMN tool_output_id;
DROP TABLE chatbot_conversation_message_tool_outputs;
DELETE FROM chatbot_conversation_messages
WHERE message_role = 'tool'::message_role;

-- turn message_role into is_from_chatbot boolean
ALTER TABLE chatbot_conversation_messages
ADD COLUMN is_from_chatbot BOOLEAN;
UPDATE chatbot_conversation_messages AS m
SET is_from_chatbot = TRUE
WHERE m.message_role = 'assistant'::message_role;
UPDATE chatbot_conversation_messages AS m
SET is_from_chatbot = FALSE
WHERE m.message_role = 'user'::message_role;

ALTER TABLE chatbot_conversation_messages DROP COLUMN message_role,
  ALTER COLUMN is_from_chatbot
SET NOT NULL;


COMMENT ON COLUMN chatbot_conversation_messages.is_from_chatbot IS 'If true, the message is from the chatbot. If false, the message is from the user.';

DROP TYPE message_role;
