CREATE TABLE chatbot_conversation_messages_citations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_message_id UUID NOT NULL REFERENCES chatbot_conversation_messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  course_material_chapter VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  content VARCHAR(255) NOT NULL,
  document_url VARCHAR(255) NOT NULL,
  citation_number INTEGER NOT NULL
);

COMMENT ON TABLE chatbot_conversation_messages_citations IS 'Stores citations associated with chatbot conversation messages. Multiple citations can be associated with a single message. Citations may be returned in a conversation if the chatbot configuration use_azure_search is true.';

COMMENT ON COLUMN chatbot_conversation_messages_citations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.conversation_message_id IS 'ID of the chatbot conversation message this citation is used in / associated with.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.conversation_id IS 'ID of the chatbot conversation that uses this citation.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.course_material_chapter IS 'The title of the course material chapter where the cited document is. Can be null if the cited document is not course material.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.title IS 'The title of the cited page/document.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.content IS 'The cited content. The block of material that was passed to the LLM.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.document_url IS 'The URL of the cited page/document.';
COMMENT ON COLUMN chatbot_conversation_messages_citations.citation_number IS 'The indexing number of the citation in the message, citation_number=1 corresponds to "doc1" in chatbot_conversation_messages.message.'
