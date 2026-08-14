ALTER TABLE chatbot_conversation_message_reasoning
ADD COLUMN encrypted_content TEXT;

COMMENT ON COLUMN chatbot_conversation_message_reasoning.encrypted_content IS 'Opaque reasoning payload from Azure, sent back on later turns so the model keeps its own reasoning. Null for rows written while responses were still stored on the Azure side and replayed by id.';
