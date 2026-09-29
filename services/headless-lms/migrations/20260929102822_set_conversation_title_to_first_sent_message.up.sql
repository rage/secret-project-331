UPDATE chatbot_conversations AS cc
SET conversation_title = msg_msgs.text
FROM chatbot_conversation_messages AS msgs
  LEFT JOIN chatbot_conversation_message_messages AS msg_msgs ON msgs.id = msg_msgs.chatbot_conversation_message_id
WHERE msgs.conversation_id = cc.id
  AND msgs.order_number = 2
  AND cc.conversation_title IS NULL
  AND cc.deleted_at IS NULL;
