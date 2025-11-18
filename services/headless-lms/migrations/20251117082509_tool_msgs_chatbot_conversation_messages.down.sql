DELETE FROM chatbot_conversation_messages
WHERE message_role = 'tool'::message_role;

ALTER TABLE chatbot_conversation_messages
ADD COLUMN is_from_chatbot BOOLEAN;
UPDATE chatbot_conversation_messages AS m
SET is_from_chatbot = TRUE
WHERE m.message_role = 'assistant'::message_role;
UPDATE chatbot_conversation_messages AS m
SET is_from_chatbot = FALSE
WHERE m.message_role = 'user'::message_role;

ALTER TABLE chatbot_conversation_messages
ALTER COLUMN is_from_chatbot
SET NOT NULL;
ALTER TABLE chatbot_conversation_messages DROP COLUMN message_role,
  DROP COLUMN tool_call_fields_id,
  DROP COLUMN tool_output_id;

COMMENT ON COLUMN chatbot_conversation_messages.is_from_chatbot IS 'If true, the message is from the chatbot. If false, the message is from the user.';

DROP TABLE chatbot_conversation_message_tool_calls CASCADE;
DROP TABLE chatbot_conversation_message_tool_outputs CASCADE;
DROP TYPE message_role;
