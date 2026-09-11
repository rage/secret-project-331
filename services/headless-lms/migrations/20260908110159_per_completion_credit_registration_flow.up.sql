ALTER TABLE course_module_completions
ADD COLUMN register_credits_via_suotar BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Decided once, when the completion is created, from the module''s enable_credit_registration_via_suotar and whether the student already had a verified student number; never recomputed, so a module switched on mid-course does not move completions already made under the old flow. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. A row with this false is registered the old way end to end.';

CREATE TYPE credit_registration_enrolment_route AS ENUM ('university_of_helsinki', 'open_university');

CREATE TABLE credit_registration_enrolment_routes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_module_completion_id UUID NOT NULL REFERENCES course_module_completions,
  user_id UUID NOT NULL REFERENCES users,
  route credit_registration_enrolment_route NOT NULL,
  enrolment_confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_enrolment_routes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_credit_registration_enrolment_routes_completion ON credit_registration_enrolment_routes (course_module_completion_id, deleted_at) NULLS NOT DISTINCT;

COMMENT ON TABLE credit_registration_enrolment_routes IS 'What the student said about enrolling, on the new registration page: which university relationship they have, and that they have gone and enrolled. Advisory only -- it picks which enrolment instructions to show and how far the page''s step list has come, and the pipeline neither reads it nor waits for it. Kept apart from course_module_completions because a completion is a graded fact and this is one person''s answer to a question about it.';
COMMENT ON COLUMN credit_registration_enrolment_routes.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_enrolment_routes.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_enrolment_routes.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_enrolment_routes.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN credit_registration_enrolment_routes.course_module_completion_id IS 'The completion the student answered about. Unique among live rows: the answer is replaced rather than versioned.';
COMMENT ON COLUMN credit_registration_enrolment_routes.user_id IS 'The student who answered. Always the completion''s own user; stored so the answer can be scoped to a user without joining.';
COMMENT ON COLUMN credit_registration_enrolment_routes.route IS 'Which university relationship the student picked, which decides only where they are told to enrol. Not evidence of anything: it is unverified self-report, and the study registry is what actually settles whether an enrolment exists.';
COMMENT ON COLUMN credit_registration_enrolment_routes.enrolment_confirmed_at IS 'When the student pressed Done to say they had enrolled. Null until they do, and cleared again if they take it back, which stays possible only until an enrolment is found -- after that the answer no longer changes anything.';

-- Gains the completion-level flag; unchanged otherwise. Replaced rather than dropped so
-- credit_registration_registrable_completions, which selects from it, survives.
CREATE OR REPLACE VIEW credit_registration_eligible_completions AS
SELECT cmc.id AS course_module_completion_id,
  cmc.user_id,
  cmc.course_id,
  cmc.course_module_id,
  cmc.completion_date,
  cmc.created_at,
  cmc.prerequisite_modules_completed
  AND NOT cmc.needs_to_be_reviewed AS fully_eligible
FROM course_module_completions cmc
  JOIN course_modules cm ON cm.id = cmc.course_module_id
WHERE cm.enable_credit_registration_via_suotar
  AND cmc.register_credits_via_suotar
  AND cm.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module opted in to credit registration, and themselves marked for the push path when they were created. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
