ALTER TABLE courses
ADD COLUMN can_add_chatbot BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.can_add_chatbot IS 'If enabled, the course can be configured to have a chatbot.';

CREATE TABLE chatbot_configurations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  enabled_to_students BOOLEAN NOT NULL DEFAULT FALSE,
  chatbot_name VARCHAR(1024) NOT NULL,
  prompt VARCHAR(32376) NOT NULL,
  initial_message VARCHAR(32376) NOT NULL,
  weekly_tokens_per_user INT NOT NULL,
  daily_tokens_per_user INT NOT NULL,
  -- Options passed to the api
  temperature FLOAT4 NOT NULL DEFAULT 0.7,
  top_p FLOAT4 NOT NULL DEFAULT 1.0,
  frequency_penalty FLOAT4 NOT NULL DEFAULT 0.0,
  presence_penalty FLOAT4 NOT NULL DEFAULT 0.0,
  response_max_tokens INT NOT NULL DEFAULT 500,
  -- Course can have only one chatbot configuration
  UNIQUE NULLS NOT DISTINCT (course_id, deleted_at)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_configurations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_configurations IS 'Tells how a chatbot on a course should behave.';
COMMENT ON COLUMN chatbot_configurations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_configurations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_configurations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_configurations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_configurations.course_id IS 'The course this chatbot is appearing on';
COMMENT ON COLUMN chatbot_configurations.enabled_to_students IS 'If enabled, students can use the chatbot..';
COMMENT ON COLUMN chatbot_configurations.chatbot_name IS 'This name will be used when presenting the chatbot to the students.';
COMMENT ON COLUMN chatbot_configurations.prompt IS 'The prompt that the chatbot will use to start the conversation.';
COMMENT ON COLUMN chatbot_configurations.initial_message IS 'The message the chatbot will send to the student when they open the chat for the first time.';
COMMENT ON COLUMN chatbot_configurations.weekly_tokens_per_user IS 'The number of tokens a student can use per week. Limits the number of messages a student can send to the chatbot based on the complexity of the messages and responses.';
COMMENT ON COLUMN chatbot_configurations.daily_tokens_per_user IS 'The number of tokens a student can use per day. Limits the number of messages a student can send to the chatbot based on the complexity of the messages and responses.';
COMMENT ON COLUMN chatbot_configurations.temperature IS 'The temperature parameter for the chatbot. The higher the temperature, the more creative the chatbot will be. The value should be between 0 and 1.';
COMMENT ON COLUMN chatbot_configurations.top_p IS 'The top_p parameter for the chatbot. The higher the top_p, the more creative the chatbot will be. The value should be between 0 and 1.';
COMMENT ON COLUMN chatbot_configurations.frequency_penalty IS 'The frequency penalty parameter for the chatbot. The value should be between 0 and 1.';
COMMENT ON COLUMN chatbot_configurations.presence_penalty IS 'The presence penalty parameter for the chatbot. The value should be between 0 and 1.';
COMMENT ON COLUMN chatbot_configurations.response_max_tokens IS 'The maximum number of tokens the chatbot can use to generate a response.';

CREATE TABLE chatbot_page_sync_statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  page_id UUID NOT NULL REFERENCES pages(id),
  error_message VARCHAR(1024),
  synced_page_revision_id UUID REFERENCES page_history(id)
);

COMMENT ON TABLE chatbot_page_sync_statuses IS 'Tells the status of whether the content of a page has been synchronized with the chatbot backend.';
COMMENT ON COLUMN chatbot_page_sync_statuses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_page_sync_statuses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_page_sync_statuses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_page_sync_statuses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_page_sync_statuses.course_id IS 'The course this chatbot is appearing on';
COMMENT ON COLUMN chatbot_page_sync_statuses.page_id IS 'The page that has been synchronized with the chatbot backend.';
COMMENT ON COLUMN chatbot_page_sync_statuses.error_message IS 'If the synchronization failed, this field contains the error message. If there is no error, the field is null.';
COMMENT ON COLUMN chatbot_page_sync_statuses.synced_page_revision_id IS 'If null, the page has not been synchronized. If not null, the page has been synchronized with the chatbot backend. The value is the id of the page revision that was succesfully synchronized. The history table is used to check for newer revisions and to sync them.';

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_page_sync_statuses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

--- Conversations
CREATE TABLE chatbot_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  user_id UUID NOT NULL,
  chatbot_configuration_id UUID NOT NULL REFERENCES chatbot_configurations(id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversations IS 'Grops the messages in a conversation between a student and a chatbot.';
COMMENT ON COLUMN chatbot_conversations.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversations.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversations.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversations.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_conversations.course_id IS 'The course this chatbot is appearing on';
COMMENT ON COLUMN chatbot_conversations.user_id IS 'The user that is participating in the conversation.';
COMMENT ON COLUMN chatbot_conversations.chatbot_configuration_id IS 'The chatbot configuration that is used in this conversation.';

-- Chatbot conversation messages
CREATE TABLE chatbot_conversation_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  conversation_id UUID NOT NULL REFERENCES chatbot_conversations(id),
  message VARCHAR(131072),
  is_from_chatbot BOOLEAN NOT NULL,
  message_is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (
    is_from_chatbot = TRUE
    OR message_is_complete = TRUE
  ),
  used_tokens INT NOT NULL DEFAULT 0,
  order_number INT NOT NULL,
  UNIQUE NULLS NOT DISTINCT (conversation_id, order_number, deleted_at)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chatbot_conversation_messages FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE chatbot_conversation_messages IS 'The messages in a conversation between a student and a chatbot.';
COMMENT ON COLUMN chatbot_conversation_messages.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chatbot_conversation_messages.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chatbot_conversation_messages.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN chatbot_conversation_messages.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chatbot_conversation_messages.conversation_id IS 'The conversation this message belongs to.';
COMMENT ON COLUMN chatbot_conversation_messages.message IS 'The message content.';
COMMENT ON COLUMN chatbot_conversation_messages.is_from_chatbot IS 'If true, the message is from the chatbot. If false, the message is from the user.';
COMMENT ON COLUMN chatbot_conversation_messages.message_is_complete IS 'Always true for messages from the user. The chatbot messages are streamed to the client, and this field is used to indicate whether that the stream is complete.';
COMMENT ON COLUMN chatbot_conversation_messages.used_tokens IS 'The number of tokens used to send or receive this message.';
COMMENT ON COLUMN chatbot_conversation_messages.order_number IS 'The order of the message in the conversation.';
