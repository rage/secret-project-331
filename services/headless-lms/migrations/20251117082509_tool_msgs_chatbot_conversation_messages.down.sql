DELETE FROM chatbot_conversation_messages
WHERE message_role = 'tool';

ALTER TABLE chatbot_conversation_messages
ALTER COLUMN message_role TYPE BOOLEAN USING CASE
    WHEN message_role = 'assistant' THEN TRUE,
    WHEN message_role = 'user' THEN FALSE
  END;
ALTER TABLE chatbot_conversation_messages
  RENAME COLUMN message_role TO is_from_chatbot;

COMMENT ON COLUMN chatbot_conversation_messages.message_role IS "If true, the message is from the chatbot. If false, the message is from the user.";
DROP TYPE message_role_type;
