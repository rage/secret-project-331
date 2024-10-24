CREATE TABLE user_marketing_consents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  user_id UUID NOT NULL REFERENCES users(id),
  consent BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT course_specific_marketing_consents_user_uniqueness UNIQUE NULLS NOT DISTINCT(user_id, course_id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_marketing_consents FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE user_marketing_consents IS 'This table is used to keep a record if a user has given a marketing consent to a course';
COMMENT ON COLUMN user_marketing_consents.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_marketing_consents.course_id IS 'Course that the user has access to.';
COMMENT ON COLUMN user_marketing_consents.user_id IS 'User who has the access to the course.';
COMMENT ON COLUMN user_marketing_consents.consent IS 'Wheter the user has given a marketing consent for a specific course.';
COMMENT ON COLUMN user_marketing_consents.created_at IS 'Timestamp of when the record was created.';
COMMENT ON COLUMN user_marketing_consents.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_marketing_consents.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TABLE courses
ADD COLUMN ask_marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.ask_marketing_consent IS 'Whether this course asks the user for marketing consent.';
