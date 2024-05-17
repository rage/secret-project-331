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
  daily_tokens_per_user INT NOT NULL,
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
COMMENT ON COLUMN chatbot_configurations.daily_tokens_per_user IS 'The number of tokens a student can use per day. Limits the number of messages a student can send to the chatbot.';

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
