ALTER TABLE chatbot_conversation_message_reasoning
ADD COLUMN reasoning_id TEXT;

UPDATE chatbot_conversation_message_reasoning
SET reasoning_id = 'unknown'
WHERE TRUE;

ALTER TABLE chatbot_conversation_message_reasoning
ALTER COLUMN reasoning_id
SET NOT NULL;

COMMENT ON COLUMN chatbot_conversation_message_reasoning.reasoning_id IS 'The id assigned to this reasoning item by Azure. Used in rendering reasoning status in the UI.';
