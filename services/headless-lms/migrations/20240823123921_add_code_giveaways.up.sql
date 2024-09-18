CREATE TABLE code_giveaways (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses(id),
  course_module_id UUID REFERENCES course_modules(id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  require_course_specific_consent_form_question_id UUID REFERENCES public.course_specific_consent_form_questions(id),
  name VARCHAR(2048) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON code_giveaways FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE code_giveaways IS 'With a code giveaway you can create a list of codes that can be distributed to students that complete a course module. To use the giveaway, the teacher needs to add a block to the course materil for the giveaway.';
COMMENT ON COLUMN code_giveaways.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN code_giveaways.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN code_giveaways.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN code_giveaways.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN code_giveaways.course_id IS 'The course the code giveaway is available on.';
COMMENT ON COLUMN code_giveaways.course_module_id IS 'The course module the code giveaway is available on. If null, the giveaway has not been placed on a course module on the CMS.';
COMMENT ON COLUMN code_giveaways.enabled IS 'If the giveaway is enabled, the codes can be given to students.';
COMMENT ON COLUMN code_giveaways.name IS 'The name of the giveaway.';
COMMENT ON COLUMN code_giveaways.require_course_specific_consent_form_question_id IS 'If not null, the student needs to consent to this question to receive a code from the giveaway.';

CREATE TABLE code_giveaway_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  code_giveaway_id UUID NOT NULL REFERENCES code_giveaways(id),
  code_given_to_user_id UUID REFERENCES users(id),
  added_by_user_id UUID NOT NULL REFERENCES users(id),
  code VARCHAR(2048) NOT NULL,
  -- No duplicate codes in a giveaway
  UNIQUE NULLS NOT DISTINCT (code_giveaway_id, code, deleted_at)
);
-- A user can only receive one code from a giveaway. We use unique index here because if we used a unique constraint we would like to have NULLS NOT disctinct on the delted_at column but NULLS DISTINCT on the code_given_to_user_id column. This did not seem possible so we use a unique index instead.
CREATE UNIQUE INDEX giveaway_codes_one_code_per_user ON code_giveaway_codes (code_giveaway_id, code_given_to_user_id)
WHERE deleted_at IS NULL;


CREATE TRIGGER set_timestamp BEFORE
UPDATE ON code_giveaway_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE code_giveaway_codes IS 'A code that is available in a code giveaway. A user can only receive one code from a giveaway.';
COMMENT ON COLUMN code_giveaway_codes.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN code_giveaway_codes.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN code_giveaway_codes.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN code_giveaway_codes.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN code_giveaway_codes.code_giveaway_id IS 'The code giveaway the code is available in.';
COMMENT ON COLUMN code_giveaway_codes.code_given_to_user_id IS 'The user the code was given to. If null, the code has not been given to a user.';
COMMENT ON COLUMN code_giveaway_codes.added_by_user_id IS 'The user that added the code to the giveaway.';
COMMENT ON COLUMN code_giveaway_codes.code IS 'The code that is given to a user.';
