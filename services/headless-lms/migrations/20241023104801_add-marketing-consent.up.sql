ALTER TABLE courses
ADD COLUMN ask_marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN courses.ask_marketing_consent IS 'Whether this course asks the user for marketing consent.';

CREATE TABLE user_marketing_consents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_language_groups_id UUID NOT NULL REFERENCES course_language_groups(id),
  user_id UUID NOT NULL REFERENCES users(id),
  user_mailchimp_id VARCHAR(255),
  consent BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  synced_to_mailchimp_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT course_language_group_specific_marketing_user_uniqueness UNIQUE NULLS NOT DISTINCT(user_id, course_language_groups_id)
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_marketing_consents FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE user_marketing_consents IS 'This table is used to keep a record if a user has given a marketing consent to a course';
COMMENT ON COLUMN user_marketing_consents.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_marketing_consents.course_id IS 'Course that the user has access to.';
COMMENT ON COLUMN user_marketing_consents.course_language_groups_id IS 'The course language group id that the mailing list is related to';
COMMENT ON COLUMN user_marketing_consents.user_id IS 'User who has the access to the course.';
COMMENT ON COLUMN user_marketing_consents.user_mailchimp_id IS 'Unique id for the user, provided by Mailchimp';
COMMENT ON COLUMN user_marketing_consents.consent IS 'Wheter the user has given a marketing consent for a specific course.';
COMMENT ON COLUMN user_marketing_consents.created_at IS 'Timestamp of when the record was created.';
COMMENT ON COLUMN user_marketing_consents.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_marketing_consents.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_marketing_consents.synced_to_mailchimp_at IS 'Timestamp when the record was synced to mailchimp. If null, the record has not been synced.';


CREATE TABLE marketing_mailing_list_access_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_language_groups_id UUID NOT NULL REFERENCES course_language_groups(id),
  server_prefix VARCHAR(255) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  mailchimp_mailing_list_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON marketing_mailing_list_access_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE marketing_mailing_list_access_tokens IS 'This table is used to keep a record of marketing mailing lists access tokens for each course language group';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.course_id IS 'The course id that the the mailing list is related to';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.course_language_groups_id IS 'The course language group id that the mailing list is related to';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.server_prefix IS 'This value is used to configure API requests to the correct Mailchimp server.';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.access_token IS 'Token used for access authentication.';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.mailchimp_mailing_list_id IS 'Id of the mailing list used for marketing in Mailchimp';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN marketing_mailing_list_access_tokens.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
