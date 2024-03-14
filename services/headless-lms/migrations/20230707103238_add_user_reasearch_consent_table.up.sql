-- Add up migration script here
CREATE TABLE user_research_consents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,
  research_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT user_id_when_not_deleted UNIQUE NULLS NOT DISTINCT(user_id, deleted_at)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_research_consents FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_research_consents IS 'Stores information whether a student has consented to participate on research done on courses';
COMMENT ON COLUMN user_research_consents.user_id IS 'The user for which the consent belongs to';
COMMENT ON COLUMN user_research_consents.research_consent IS 'Whether or not the student has given a consent to research';
COMMENT ON COLUMN user_research_consents.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_research_consents.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_research_consents.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
