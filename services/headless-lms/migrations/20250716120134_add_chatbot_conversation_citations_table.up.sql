CREATE TABLE chatbot_conversation_messages_citations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_message_id UUID NOT NULL REFERENCES chatbot_conversation_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  course_material_chapter_number INTEGER,
  title VARCHAR(255) NOT NULL,
  content VARCHAR(255) NOT NULL,
  document_url VARCHAR(255) NOT NULL,
  citation_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_messages_citations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_messages_citations IS 'Stores citations associated with chatbot conversation messages. Multiple citations can be associated with a single message. Citations may be returned in a conversation if the chatbot configuration use_azure_search is true.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.conversation_message_id IS 'ID of the chatbot conversation message this citation is used in / associated with.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.conversation_id IS 'ID of the chatbot conversation that uses this citation.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.course_material_chapter_number IS 'The number of the course material chapter where the cited document is. Can be null if the cited document is not course material or does not belong to any chapter.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.title IS 'The title of the cited page/document.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.content IS 'The cited content. The chunk of material that was passed to the LLM.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.document_url IS 'The URL of the cited page/document.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.citation_number IS 'The indexing number of the citation in the message, citation_number=1 corresponds to "doc1" in chatbot_conversation_messages.message.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
