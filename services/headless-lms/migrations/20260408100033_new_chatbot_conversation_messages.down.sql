ALTER TYPE message_role
RENAME VALUE 'developer' TO 'tool';

ALTER TABLE chatbot_conversation_messages
ADD COLUMN message VARCHAR(131072),
  ADD COLUMN message_role message_role,
  ADD COLUMN tool_output_id UUID REFERENCES chatbot_conversation_message_tool_outputs(id),
  ADD COLUMN used_tokens INT NOT NULL DEFAULT 0,
  ADD COLUMN message_is_complete BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN chatbot_conversation_messages.message IS 'The message content.';
COMMENT ON COLUMN chatbot_conversation_messages.message_role IS 'The role of the message, is it from the user or the chatbot, or does it contain chatbot tool call output.';
COMMENT ON COLUMN chatbot_conversation_messages.message_is_complete IS 'Always true for messages from the user. The chatbot messages are streamed to the client, and this field is used to indicate whether that the stream is complete.';
COMMENT ON COLUMN chatbot_conversation_messages.used_tokens IS 'The number of tokens used to send or receive this message.';

UPDATE chatbot_conversation_messages ccm
SET message = ccmm.text,
  message_role = ccmm.message_role,
  used_tokens = ccmm.used_tokens,
  message_is_complete = ccmm.message_is_complete
FROM chatbot_conversation_message_messages ccmm
WHERE ccm.id = ccmm.chatbot_conversation_message_id;

UPDATE chatbot_conversation_messages ccm
SET tool_output_id = ccmto.id,
  message_role = 'tool'::message_role
FROM chatbot_conversation_message_tool_outputs ccmto
WHERE ccm.id = ccmto.chatbot_conversation_message_id;

UPDATE chatbot_conversation_messages ccm
SET message_role = 'assistant'::message_role
FROM chatbot_conversation_message_tool_calls ccmtc
WHERE ccm.id = ccmtc.chatbot_conversation_message_id;

DELETE FROM chatbot_conversation_messages ccm USING chatbot_conversation_message_reasoning ccmr
WHERE ccm.id = ccmr.chatbot_conversation_message_id;

ALTER TABLE chatbot_conversation_messages
ALTER COLUMN message_role
SET NOT NULL;

DROP TABLE chatbot_conversation_message_messages;
DROP TABLE chatbot_conversation_message_reasoning;

ALTER TABLE chatbot_conversation_message_tool_calls DROP COLUMN tool_kind;
ALTER TABLE chatbot_conversation_message_tool_calls
  RENAME COLUMN chatbot_conversation_message_id TO message_id;

ALTER TABLE chatbot_conversation_message_tool_outputs DROP COLUMN tool_kind;
ALTER TABLE chatbot_conversation_message_tool_outputs
  RENAME COLUMN chatbot_conversation_message_id TO message_id;
ALTER TABLE chatbot_conversation_message_tool_outputs
  RENAME COLUMN output TO tool_output;

DROP TYPE tool_kind;
