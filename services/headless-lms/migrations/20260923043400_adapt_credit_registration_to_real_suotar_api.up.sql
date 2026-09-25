-- Every lock is held until commit; fail fast rather than queue every reader of a hot table behind us.
-- Statements that lock course_modules, course_module_completions, users or email_templates are last.
SET LOCAL lock_timeout = '5s';

DROP TABLE open_university_product_access_tokens;

DELETE FROM credit_registration_phase_state
WHERE phase = 'product-token-refresh';

ALTER TABLE course_module_suotar_configurations
DROP CONSTRAINT course_module_suotar_configurations_check_result,
  DROP COLUMN open_university_product_id,
  DROP COLUMN product_token_found,
  DROP COLUMN grade_scale_id;
ALTER TABLE course_module_suotar_configurations
  RENAME COLUMN course_code_resolves TO course_code_allowed;

-- A checked row may still carry no verdict: the check can run without Suotar answering for the code.
ALTER TABLE course_module_suotar_configurations
ADD CONSTRAINT course_module_suotar_configurations_check_result CHECK (
    config_checked_at IS NOT NULL
    OR course_code_allowed IS NULL
  );

COMMENT ON COLUMN course_module_suotar_configurations.config_checked_at IS 'When the config-validation phase last checked this module. NULL means never checked, so the admin view can show unknown instead of implying a passing check it never ran.';
COMMENT ON COLUMN course_module_suotar_configurations.course_code_allowed IS 'Whether Suotar accepted the module''s course code at the last config check. NULL means not checked, or checked without Suotar giving a verdict.';

ALTER TABLE course_module_suotar_configurations
ADD COLUMN checked_course_code VARCHAR(255),
  ADD COLUMN course_code_rejection TEXT;

COMMENT ON COLUMN course_module_suotar_configurations.checked_course_code IS 'The course code course_code_allowed is a verdict on. Once the module''s uh_course_code changes, the verdict no longer applies.';
COMMENT ON COLUMN course_module_suotar_configurations.course_code_rejection IS 'Suotar''s own reason for not accepting checked_course_code, quoted to operators. NULL unless course_code_allowed is false.';

CREATE OR REPLACE VIEW credit_registration_preconditions AS
SELECT cr.id AS credit_registration_id,
  cmc.deleted_at IS NOT NULL AS completion_deleted,
  cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects
  AND cmc.prerequisite_modules_completed
  AND NOT cmc.needs_to_be_reviewed AS completion_eligible,
  vsn.id IS NOT NULL AS has_verified_student_number,
  cr.student_number IS NOT NULL
  AND (
    vsn.student_number IS DISTINCT FROM cr.student_number
    OR vsn.sisu_person_id IS DISTINCT FROM cr.sisu_person_id
  ) AS frozen_identity_stale,
  NOT EXISTS (
    SELECT 1
    FROM course_module_suotar_configurations conf
    WHERE conf.course_module_id = cr.course_module_id
      AND conf.deleted_at IS NULL
      AND NOT conf.course_code_allowed
      AND conf.checked_course_code = TRIM(cm.uh_course_code)
  ) AS course_code_allowed
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;

COMMENT ON COLUMN credit_registration_preconditions.course_code_allowed IS 'False while Suotar''s last verdict on the module''s current course code says it does not accept it; true once it does, or when there is no verdict. Rows wait in pending while false, since every import would come back courseNotAllowed.';

-- The old type is dropped only after course_module_suotar_realisations, which still uses it.
ALTER TYPE credit_registration_error_code
RENAME TO credit_registration_error_code_old;

CREATE TYPE credit_registration_error_code AS ENUM (
  'person_not_found',
  'course_code_not_found',
  'enrolment_not_found',
  'enrolment_not_accepted',
  'invalid_grade_for_grade_scale',
  'grade_scale_mismatch',
  'course_not_allowed',
  'invalid_credits',
  'study_right_not_valid',
  'sisu_validation_failed',
  'sisu_timeout',
  'service_temporarily_unavailable',
  'misregistered',
  'not_registered',
  'unauthorized',
  'malformed_request',
  'transport_error',
  'unexpected_response',
  'no_grade_scale_mapping',
  'missing_uh_course_code',
  'missing_ects_credits',
  'retry_window_expired',
  'unknown'
);

ALTER TABLE credit_registrations
ALTER COLUMN error_code TYPE credit_registration_error_code USING error_code::text::credit_registration_error_code;

ALTER TABLE credit_registration_events
ALTER COLUMN error_code TYPE credit_registration_error_code USING error_code::text::credit_registration_error_code;

COMMENT ON TYPE credit_registration_error_code IS 'Why a credit registration is where it is. The values up to not_registered are Suotar moocfi per-item codes in snake_case; the rest are ours. service_temporarily_unavailable, not_registered and transport_error normally sit on failed_retryable, everything else on failed_permanent.';

ALTER TYPE suotar_endpoint
RENAME TO suotar_endpoint_old;

CREATE TYPE suotar_endpoint AS ENUM (
  'resolve_persons',
  'resolve_enrolments',
  'import_attainments',
  'verify_attainments',
  'list_by_course',
  'validate_course_codes'
);

ALTER TABLE suotar_api_calls
ALTER COLUMN endpoint TYPE suotar_endpoint USING endpoint::text::suotar_endpoint;

DROP TYPE suotar_endpoint_old;

COMMENT ON TYPE suotar_endpoint IS 'Which Suotar endpoint an API call row is about.';

DROP INDEX uq_credit_registrations_request_item_id;

ALTER TABLE credit_registrations DROP COLUMN request_item_id;

ALTER TABLE credit_registration_events
ADD COLUMN request_item_id VARCHAR(255);

CREATE INDEX idx_credit_registration_events_request_item_id ON credit_registration_events (request_item_id)
WHERE request_item_id IS NOT NULL;

COMMENT ON COLUMN credit_registration_events.request_item_id IS 'The requestItemId this row went out under in the Suotar call behind the event. A fresh UUID per call, so this and suotar_api_calls.request_item_ids are the only way to find the row in either side''s log.';

ALTER TABLE suotar_api_calls
ADD COLUMN request_item_ids TEXT [] NOT NULL DEFAULT '{}';

CREATE INDEX idx_suotar_api_calls_request_item_ids ON suotar_api_calls USING GIN (request_item_ids);

COMMENT ON COLUMN suotar_api_calls.request_item_ids IS 'Every requestItemId the call sent, in request order. Joins to credit_registration_events.request_item_id.';

-- duplicateRequestItem hands a later row of the same batch the submitted attainment of an earlier one.
DROP INDEX uq_credit_registrations_submitted_attainment;

ALTER TABLE credit_registrations
ADD COLUMN partially_registered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN not_registered_reimport_count INT NOT NULL DEFAULT 0,
  ADD COLUMN selected_enrolment_realisation_name JSONB,
  ADD COLUMN resubmit_not_before TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT credit_registrations_reimport_count_nonnegative CHECK (not_registered_reimport_count >= 0);

COMMENT ON COLUMN credit_registrations.partially_registered_at IS 'When verify first saw only an assessment item attainment for the submission, with the course unit attainment still missing. Cleared on resubmission.';
COMMENT ON COLUMN credit_registrations.not_registered_reimport_count IS 'How many times Suotar answered notRegistered for a submission of this row and it was sent back to import.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_realisation_name IS 'Localized name ({fi, sv, en}, each optional) of the course unit realisation the chosen enrolment belongs to, as Suotar reported it.';
COMMENT ON COLUMN credit_registrations.resubmit_not_before IS 'The retryAfter of Suotar''s last submissionPending answer: until then Suotar may still turn the pending submission into an attainment, so a second import could register the credits twice. Cleared when Suotar answers notRegistered.';

ALTER TABLE credit_registrations
ADD COLUMN pending_superseded_by_id UUID REFERENCES credit_registrations(id),
  ADD CONSTRAINT credit_registrations_pending_superseded_by_not_self CHECK (pending_superseded_by_id <> id),
  ADD CONSTRAINT credit_registrations_superseded_or_pending CHECK (
    superseded_by_id IS NULL
    OR pending_superseded_by_id IS NULL
  );

-- A regrade leaves the registered row live beside it until the registry holds the new grade.
DROP INDEX uq_credit_registrations_completion;
CREATE UNIQUE INDEX uq_credit_registrations_completion ON credit_registrations (course_module_completion_id)
WHERE deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state NOT IN ('registered', 'duplicate', 'not_improved');

DROP INDEX uq_credit_registrations_person_module;
CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND pending_superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'registered',
    'duplicate',
    'not_improved'
  );
CREATE INDEX idx_credit_registrations_pending_superseded_by ON credit_registrations (pending_superseded_by_id)
WHERE pending_superseded_by_id IS NOT NULL;

COMMENT ON COLUMN credit_registrations.superseded_by_id IS 'The later attempt that replaced this row. A registered row is superseded only once the study registry holds its replacement (see pending_superseded_by_id), and keeps its state and terminal_at, because it really was registered.';
COMMENT ON COLUMN credit_registrations.pending_superseded_by_id IS 'A later attempt, a regrade of the same completion or another of the student''s completions for the module, that is being sent to replace this registered row. Until the study registry holds it, this row stays the live credit and keeps its place in uq_credit_registrations_person_module. Becomes superseded_by_id when that attempt reaches registered or duplicate, and is cleared if it stops short.';

ALTER TABLE credit_registrations
ADD COLUMN no_usable_enrolment_since TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN credit_registrations.no_usable_enrolment_since IS 'When the row started waiting for an enrolment, kept through every check that finds none and through the ready_to_submit, resolving_enrolment and failed_retryable a first check or a retried lookup passes through. Cleared once the row stops waiting, for example when an enrolment is found.';

UPDATE credit_registrations
SET no_usable_enrolment_since = state_entered_at
WHERE state = 'no_usable_enrolment';

ALTER TABLE course_module_suotar_configurations
ADD COLUMN last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listing_error credit_registration_error_code,
  ADD COLUMN consecutive_listing_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN last_listed_person_count INT,
  ADD COLUMN last_already_linked_count INT,
  ADD COLUMN last_mailed_count INT,
  ADD COLUMN last_suppressed_by_dedup_count INT,
  ADD COLUMN last_suppressed_by_rate_cap_count INT,
  ADD COLUMN last_no_address_count INT;

COMMENT ON COLUMN course_module_suotar_configurations.last_listing_attempted_at IS 'When enrolment discovery last tried to list this module''s course code, whether or not the roster arrived. Orders the listing queue, so a module that keeps failing cannot starve the rest.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listed_at IS 'When enrolment discovery last listed this module''s course code successfully.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course: the last_* counters keep describing the last roster that did arrive.';
COMMENT ON COLUMN course_module_suotar_configurations.consecutive_listing_failures IS 'Failed listing attempts since the last successful one.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listed_person_count IS 'How many persons the last listing returned.';
COMMENT ON COLUMN course_module_suotar_configurations.last_already_linked_count IS 'Of the last listing, how many persons already had a linked account.';
COMMENT ON COLUMN course_module_suotar_configurations.last_mailed_count IS 'Of the last listing, how many linking mails were queued.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because we had already mailed that person and address for this course.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_rate_cap_count IS 'Of the last listing, how many mails were suppressed by a per-person rate cap.';
COMMENT ON COLUMN course_module_suotar_configurations.last_no_address_count IS 'Of the last listing, how many persons had no usable address to mail.';

CREATE TYPE enrolment_check_group AS ENUM ('completed', 'visited', 'check_requested');

COMMENT ON TYPE enrolment_check_group IS 'How strongly a student has signalled that they are enrolling, which picks the schedule we look for their enrolment on. Ordered, and a row only ever moves to a later value. completed: finished the module and has not opened its registration page since. visited: opened the registration page after completing while it showed the enrolment instructions. check_requested: pressed a button saying they had enrolled, had a teacher ask for a check, or linked their student number from a mail sent off the course roster.';

CREATE TYPE enrolment_check_source AS ENUM (
  'schedule',
  'student_request',
  'teacher_request',
  'admin_request',
  'roster_listing',
  'account_link'
);

COMMENT ON TYPE enrolment_check_source IS 'What made an enrolment check run when it did. schedule is the group''s own ladder; every other value brought a check forward, so lateness is measured on schedule checks only.';

ALTER TABLE credit_registrations
ADD COLUMN enrolment_check_group enrolment_check_group NOT NULL DEFAULT 'completed',
  ADD COLUMN enrolment_check_anchor_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN enrolment_check_step INT,
  ADD COLUMN enrolment_check_due_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN is_enrolment_check_batched BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN enrolment_check_source enrolment_check_source NOT NULL DEFAULT 'schedule',
  ADD COLUMN enrolment_checks_stopped_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN enrolment_check_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN enrolment_check_restart_window_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN enrolment_check_restart_count INT NOT NULL DEFAULT 0,
  ADD COLUMN seen_enrolment_ids TEXT [],
  ADD COLUMN enrolment_check_claimed_until TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT credit_registrations_enrolment_check_claimed CHECK (
    enrolment_check_claimed_until IS NULL
    OR state = 'no_usable_enrolment'
  ),
  ADD CONSTRAINT credit_registrations_enrolment_check_step CHECK (
    (enrolment_check_step IS NULL) = (enrolment_check_due_at IS NULL)
    AND (
      enrolment_check_step IS NULL
      OR (
        enrolment_check_step >= 0
        AND enrolment_check_anchor_at IS NOT NULL
      )
    )
  ),
  ADD CONSTRAINT credit_registrations_enrolment_checks_stopped CHECK (
    enrolment_checks_stopped_at IS NULL
    OR (
      enrolment_check_step IS NULL
      AND enrolment_check_anchor_at IS NOT NULL
    )
  ),
  ADD CONSTRAINT credit_registrations_enrolment_check_restart_count CHECK (enrolment_check_restart_count >= 0);

CREATE INDEX idx_credit_registrations_batched_enrolment_checks ON credit_registrations (enrolment_check_due_at)
WHERE state = 'no_usable_enrolment'
  AND is_enrolment_check_batched
  AND deleted_at IS NULL;

CREATE INDEX idx_credit_registrations_module_created ON credit_registrations (course_module_id, created_at DESC)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN credit_registrations.enrolment_check_group IS 'Which enrolment check schedule the row follows. Kept for the row''s whole life, through every state, and inherited by a later attempt for the same student and module.';
COMMENT ON COLUMN credit_registrations.enrolment_check_anchor_at IS 'What the group''s schedule offsets are counted from: the completion or the link, whichever is later, for completed; the latest restart for the other groups. NULL until the row first waits for an enrolment.';
COMMENT ON COLUMN credit_registrations.enrolment_check_step IS 'Zero-based index into the group''s schedule of the check the row waits for. Moves only when a check answers, never when one is claimed. NULL while no check is scheduled, including after the schedule has run out.';
COMMENT ON COLUMN credit_registrations.enrolment_check_due_at IS 'The schedule time of enrolment_check_step, which next_attempt_at loses whenever a check is brought forward or waits out a failed lookup.';
COMMENT ON COLUMN credit_registrations.is_enrolment_check_batched IS 'Whether the scheduled check is a slow one (a gap of a day or more): released only on a five-minute boundary, and pulled up to 15 minutes forward into a batch that is going out anyway.';
COMMENT ON COLUMN credit_registrations.enrolment_check_source IS 'What made the next or running enrolment check due. Back to schedule once the check answers.';
COMMENT ON COLUMN credit_registrations.enrolment_checks_stopped_at IS 'When the schedule ran out without an enrolment. The row keeps waiting in no_usable_enrolment and nothing tells the student; a visit, a check request, a new completion or a roster listing can still wake it.';
COMMENT ON COLUMN credit_registrations.enrolment_check_requested_at IS 'When a student or teacher last asked for a check. With enrolment_checked_at, it is what the shared 30-minute limit on asking is counted from.';
COMMENT ON COLUMN credit_registrations.enrolment_check_restart_window_started_at IS 'Start of the 24-hour window enrolment_check_restart_count counts in.';
COMMENT ON COLUMN credit_registrations.enrolment_check_restart_count IS 'How many check requests restarted the schedule in the current window. Past the daily cap a request still gets one check, without a restart.';
COMMENT ON COLUMN credit_registrations.enrolment_check_claimed_until IS 'Set while resolve-enrolments has a lookup out for a row parked in no_usable_enrolment, which stays in that state for the call: no other lookup claims the row before this time. The answer clears it; a worker that died mid-call leaves it to expire.';
COMMENT ON COLUMN credit_registrations.seen_enrolment_ids IS 'Every Sisu enrolment id the row''s checks have seen, plus those a roster listing has already woken it for. A listing naming any other id wakes the row. NULL until the first check, so any listing wakes a row never checked.';


CREATE TABLE credit_registration_enrolment_check_signals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_module_completion_id UUID NOT NULL,
  last_visited_at TIMESTAMP WITH TIME ZONE,
  last_check_requested_at TIMESTAMP WITH TIME ZONE,
  check_request_source enrolment_check_source,
  CONSTRAINT credit_registration_enrolment_check_signals_request_source CHECK (
    (last_check_requested_at IS NULL) = (check_request_source IS NULL)
    AND check_request_source IS DISTINCT FROM 'schedule'
    AND check_request_source IS DISTINCT FROM 'roster_listing'
    AND check_request_source IS DISTINCT FROM 'admin_request'
  )
);

CREATE UNIQUE INDEX uq_credit_registration_enrolment_check_signals_completion ON credit_registration_enrolment_check_signals (course_module_completion_id)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_enrolment_check_signals FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_enrolment_check_signals IS 'Visits to the registration page and check requests, per completion, recorded whether or not the completion has a ledger row or a linked student number yet. A row that starts waiting for an enrolment takes its group from here.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.course_module_completion_id IS 'The completion the signals are about. Unique among live rows.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.last_visited_at IS 'When the student last opened the registration page after completing, while it showed the enrolment instructions.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.last_check_requested_at IS 'When a check was last asked for: by the student, by a teacher, or by linking a student number from a roster mail.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.check_request_source IS 'Who asked for the check at last_check_requested_at.';

CREATE TABLE credit_registration_roster_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  course_code VARCHAR(255) NOT NULL,
  last_attempted_at TIMESTAMP WITH TIME ZONE,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  last_fetch_duration_ms INT,
  last_listed_person_count INT,
  triggered_fetch_at TIMESTAMP WITH TIME ZONE,
  follow_up_fetch_at TIMESTAMP WITH TIME ZONE,
  triggered_fetch_day DATE,
  triggered_fetch_count INT NOT NULL DEFAULT 0,
  is_fetched_alone BOOLEAN NOT NULL DEFAULT FALSE,
  consecutive_failures INT NOT NULL DEFAULT 0,
  retry_not_before TIMESTAMP WITH TIME ZONE,
  last_error credit_registration_error_code,
  window_closed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT credit_registration_roster_schedules_counts CHECK (
    triggered_fetch_count >= 0
    AND consecutive_failures >= 0
  )
);

CREATE UNIQUE INDEX uq_credit_registration_roster_schedules_course_code ON credit_registration_roster_schedules (course_code);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_roster_schedules FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_roster_schedules IS 'When enrolment discovery lists each course code''s roster. The tier (three a day while completions keep coming, then daily, and weekly with account linking on) is derived at claim time from the modules on the code, so only what cannot be derived is kept here. Modules sharing a code share its row. The per-module counters on course_module_suotar_configurations still describe what each module did with the roster.';
COMMENT ON COLUMN credit_registration_roster_schedules.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_roster_schedules.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_roster_schedules.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_roster_schedules.course_code IS 'The trimmed uh_course_code the roster is listed by.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_attempted_at IS 'When a listing of the code was last sent, whether or not it arrived.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_fetched_at IS 'When the roster last arrived. The tier interval is counted from here.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_fetch_duration_ms IS 'How long the request that last brought the roster took, in milliseconds. Shared by every code in that request.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_listed_person_count IS 'How many enrolments the last roster listed.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_at IS 'A listing an unlinked student''s visit or check request asked for, with account linking on. Claimed before any tier.';
COMMENT ON COLUMN credit_registration_roster_schedules.follow_up_fetch_at IS 'The one later listing an unlinked student''s visit books, for an enrolment Suotar''s copy of Sisu did not have yet.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_day IS 'The UTC day triggered_fetch_count counts.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_count IS 'How many triggered and follow-up listings ran on triggered_fetch_day, against the daily cap.';
COMMENT ON COLUMN credit_registration_roster_schedules.is_fetched_alone IS 'Set when a request batching this code with others failed as a whole: Suotar fails every code of a request for one bad one, so the code is listed on its own until a listing of it succeeds.';
COMMENT ON COLUMN credit_registration_roster_schedules.consecutive_failures IS 'Failed listings of the code on its own since the last success. Drives the per-code backoff and the admin alert.';
COMMENT ON COLUMN credit_registration_roster_schedules.retry_not_before IS 'Until when the code is left alone after failing on its own.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_error IS 'Why the last listing of the code failed; NULL once one succeeds.';
COMMENT ON COLUMN credit_registration_roster_schedules.window_closed_at IS 'When Suotar last said it holds no realisation of the code, which it does once the last one ended over two months ago. Tier listings stop until a completion arrives after this.';

CREATE TABLE credit_registration_enrolment_check_outcomes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  credit_registration_id UUID NOT NULL REFERENCES credit_registrations(id),
  course_module_id UUID NOT NULL,
  enrolment_check_group enrolment_check_group NOT NULL,
  enrolment_check_step INT,
  source enrolment_check_source NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  previous_checked_at TIMESTAMP WITH TIME ZONE,
  is_enrolment_found BOOLEAN NOT NULL,
  enrolled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_credit_registration_enrolment_check_outcomes_checked ON credit_registration_enrolment_check_outcomes (checked_at DESC);
CREATE INDEX idx_credit_registration_enrolment_check_outcomes_registration ON credit_registration_enrolment_check_outcomes (credit_registration_id);

COMMENT ON TABLE credit_registration_enrolment_check_outcomes IS 'One row per answered enrolment check of a row waiting for an enrolment: the data the check schedules are tuned from, offline. Ids and times only, and kept for 400 days, well past the call log''s 90.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.credit_registration_id IS 'The row that was checked.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.course_module_id IS 'The row''s module, kept so outcomes can be grouped by course without the ledger.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.enrolment_check_group IS 'The row''s group when it was checked.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.enrolment_check_step IS 'The schedule step the row was waiting for. NULL once the schedule had run out.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.source IS 'What made the check run.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.due_at IS 'The schedule time of that step. Lateness is checked_at minus this, on schedule checks.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.checked_at IS 'When Suotar answered.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.previous_checked_at IS 'When the row was last checked before this, NULL for its first check. With checked_at it brackets when an enrolment found here appeared.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.is_enrolment_found IS 'Whether the check found an enrolment the row can be registered against.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.enrolled_at IS 'When the enrolment found was made, as Sisu records it; NULL when none was found or Sisu gives no time.';

CREATE TABLE suotar_endpoint_rate_limits (
  endpoint suotar_endpoint PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  rate_share REAL NOT NULL,
  full_rate_per_minute INT NOT NULL,
  available INT NOT NULL,
  is_breaker_open BOOLEAN NOT NULL,
  breaker_trip_count INT NOT NULL
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON suotar_endpoint_rate_limits FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE suotar_endpoint_rate_limits IS 'The last state the worker process''s in-memory limiter and circuit breaker reported for each rate-limited Suotar endpoint, so the dashboard in another process can show it. Written by the worker, never read back by it.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.endpoint IS 'The limited endpoint.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.updated_at IS 'Timestamp when the record was last updated, which is when the worker last reported this state. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.rate_share IS 'The share of the full rate currently allowed, 0.1 to 1: it drops to 0.1 after failures or a breaker cooldown and doubles every five healthy minutes.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.full_rate_per_minute IS 'The full rate, in items per minute, or requests per minute for list_by_course.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.available IS 'Items, or requests for list_by_course, that could be sent right now.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.is_breaker_open IS 'Whether the circuit breaker the endpoint''s phases share was open.';
COMMENT ON COLUMN suotar_endpoint_rate_limits.breaker_trip_count IS 'How many times in a row the breaker has opened without a success between; the cooldown grows with it.';

UPDATE credit_registration_phase_state
SET expected_interval_secs = 60
WHERE phase = 'enrolment-discovery';

CREATE TYPE student_number_verification_method_new AS ENUM (
  'emailed_link',
  'admin_manual',
  'study_registry'
);

ALTER TABLE verified_student_numbers DROP CONSTRAINT verified_student_numbers_proof_address,
  DROP CONSTRAINT verified_student_numbers_match_field_method,
  DROP CONSTRAINT verified_student_numbers_admin_linker,
  DROP CONSTRAINT verified_student_numbers_link_reason,
  DROP COLUMN verified_via_email_match_field,
  DROP COLUMN account_email_verified_at,
  DROP COLUMN auto_link_notice_dismissed_at,
  ALTER COLUMN verified_via DROP DEFAULT;

ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via TYPE student_number_verification_method_new USING verified_via::text::student_number_verification_method_new;

DROP TYPE student_number_verification_method;

ALTER TYPE student_number_verification_method_new
RENAME TO student_number_verification_method;

ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via
SET DEFAULT 'emailed_link',
  ALTER COLUMN sisu_person_id DROP NOT NULL,
  ADD CONSTRAINT verified_student_numbers_proof_address CHECK (
    (verified_via IN ('admin_manual', 'study_registry')) = (verified_via_email IS NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_admin_linker CHECK (
    (verified_via = 'admin_manual') = (linked_by_user_id IS NOT NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_link_reason CHECK (
    verified_via = 'admin_manual'
    OR link_reason IS NULL
  ),
  ADD CONSTRAINT verified_student_numbers_person_id CHECK (
    verified_via = 'study_registry'
    OR sisu_person_id IS NOT NULL
  );

COMMENT ON TYPE student_number_verification_method IS 'How a student number was proven to belong to an account. A discriminator, not a flag: reads that care about strength of proof must match exhaustively. study_registry means a registrar reported registering one of the account''s completions under the number.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email IS 'The Sisu-held address the linking mail was sent to. NULL exactly for admin_manual and study_registry rows.';
COMMENT ON COLUMN verified_student_numbers.sisu_person_id IS 'Sisu person id reported alongside the student number. Stable across student number changes, live-unique, and the identity the double-registration guards key on. NULL only for study_registry rows, whose registrar reports a number and no person; nothing we send to Suotar needs it.';

CREATE INDEX idx_cmc_registered_to_study_registries_registrar_user ON course_module_completion_registered_to_study_registries (user_id, created_at DESC)
WHERE deleted_at IS NULL
  AND study_registry_registrar_id IS NOT NULL;

CREATE VIEW study_registry_reported_student_numbers AS
SELECT DISTINCT ON (r.user_id) r.id AS registered_completion_id,
  r.user_id,
  REGEXP_REPLACE(r.real_student_number, '\s', '', 'g') AS student_number
FROM course_module_completion_registered_to_study_registries r
  JOIN users u ON u.id = r.user_id
  JOIN course_module_completions cmc ON cmc.id = r.course_module_completion_id
WHERE r.deleted_at IS NULL
  AND r.study_registry_registrar_id IS NOT NULL
  AND u.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
ORDER BY r.user_id,
  r.created_at DESC,
  r.id DESC;

COMMENT ON VIEW study_registry_reported_student_numbers IS 'Per live account, the student number a third-party registrar most recently reported registering one of its live completions under, whitespace stripped. Our own mirrored rows are left out: their number came from verified_student_numbers in the first place.';

-- The users foreign key is added at the end, with the other locks on hot tables.
CREATE TABLE study_registry_student_number_conflicts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL,
  student_number VARCHAR(32) NOT NULL,
  registered_completion_id UUID NOT NULL REFERENCES course_module_completion_registered_to_study_registries(id),
  conflicting_verified_student_number_id UUID NOT NULL REFERENCES verified_student_numbers(id)
);

CREATE UNIQUE INDEX uq_study_registry_student_number_conflicts ON study_registry_student_number_conflicts (user_id, student_number)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON study_registry_student_number_conflicts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE study_registry_student_number_conflicts IS 'Student numbers a registrar reported for an account that could not become its study_registry link because a live link already stood in the way. The existing link is kept; a row stops mattering once the account holds the reported number.';
COMMENT ON COLUMN study_registry_student_number_conflicts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN study_registry_student_number_conflicts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN study_registry_student_number_conflicts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN study_registry_student_number_conflicts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN study_registry_student_number_conflicts.user_id IS 'The account whose completion the registrar reported.';
COMMENT ON COLUMN study_registry_student_number_conflicts.student_number IS 'The number the registrar reported, whitespace stripped.';
COMMENT ON COLUMN study_registry_student_number_conflicts.registered_completion_id IS 'The registrar''s record the number came from.';
COMMENT ON COLUMN study_registry_student_number_conflicts.conflicting_verified_student_number_id IS 'The live link that stood in the way: the account''s own link to another number, or another account''s link to this number.';

INSERT INTO verified_student_numbers (user_id, student_number, verified_via)
SELECT DISTINCT ON (reported.student_number) reported.user_id,
  reported.student_number,
  'study_registry'
FROM study_registry_reported_student_numbers reported
WHERE reported.student_number ~ '^[0-9]{6,12}$'
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = reported.user_id
      AND vsn.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.student_number = reported.student_number
      AND vsn.deleted_at IS NULL
  )
ORDER BY reported.student_number,
  reported.user_id;

INSERT INTO study_registry_student_number_conflicts (
    user_id,
    student_number,
    registered_completion_id,
    conflicting_verified_student_number_id
  )
SELECT reported.user_id,
  reported.student_number,
  reported.registered_completion_id,
  blocker.id
FROM study_registry_reported_student_numbers reported
  JOIN LATERAL (
    SELECT vsn.id
    FROM verified_student_numbers vsn
    WHERE vsn.deleted_at IS NULL
      AND (
        (
          vsn.user_id = reported.user_id
          AND vsn.student_number <> reported.student_number
        )
        OR (
          vsn.user_id <> reported.user_id
          AND vsn.student_number = reported.student_number
        )
      )
    ORDER BY vsn.user_id = reported.user_id DESC
    LIMIT 1
  ) blocker ON TRUE
WHERE reported.student_number ~ '^[0-9]{6,12}$';

-- Soft-deleted rather than relabelled: email_deliveries reference them. deleted_at differs per row
-- because unique_email_templates_type_language_general keys on it NULLS NOT DISTINCT.
UPDATE email_templates t
SET email_template_type = 'generic',
  deleted_at = COALESCE(
    t.deleted_at,
    now() - (r.n * INTERVAL '1 microsecond')
  )
FROM (
    SELECT id,
      row_number() OVER (
        ORDER BY id
      ) AS n
    FROM email_templates
    WHERE email_template_type = 'credit_registration_student_number_linked'
  ) r
WHERE t.id = r.id;

ALTER TYPE email_template_type
RENAME TO email_template_type_old;

CREATE TYPE email_template_type AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code',
  'credit_registration_account_linking',
  'verify_email_address',
  'credit_registration_action_needed',
  'credit_registration_registered'
);

ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type USING (
    email_template_type::text::email_template_type
  );

DROP TYPE email_template_type_old;

COMMENT ON TYPE email_template_type IS 'Type of email template: generic templates do not support automated placeholder replacements, others do.';

-- {{ENROLMENT_LINK}} is empty when the module has no link, so its sentence must read without it.
INSERT INTO email_templates (email_template_type, language, subject, content)
SELECT seed.email_template_type,
  seed.language,
  seed.subject,
  seed.content
FROM (
    VALUES (
        'credit_registration_action_needed'::email_template_type,
        'en',
        'Enrol on the course to get your credits registered',
        '[
          {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000001", "attributes": {"content": "Hello, you have completed {{COURSE_NAME}} ({{CREDITS}} credits). To register your credits in Sisu, you need to be enrolled on the course. We cannot find an enrolment for you yet.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000002", "attributes": {"content": "If you have not enrolled yet, please enrol. {{ENROLMENT_LINK}}", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000003", "attributes": {"content": "We check regularly and register your credits automatically once we can see your enrolment. If you have enrolled, you do not need to do anything else.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d3000000-0000-0000-0000-000000000004", "attributes": {"content": "You can see the details and how to enrol here: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
        ]'::jsonb
      ),
      (
        'credit_registration_action_needed'::email_template_type,
        'fi',
        'Ilmoittaudu kurssille, jotta voimme kirjata opintopisteesi',
        '[
          {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000001", "attributes": {"content": "Hei, olet suorittanut kurssin {{COURSE_NAME}} ({{CREDITS}} op). Jotta voimme kirjata opintopisteesi Sisuun, sinun pitää olla ilmoittautunut kurssille. Emme vielä löydä ilmoittautumistasi.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000002", "attributes": {"content": "Jos et ole vielä ilmoittautunut, ilmoittaudu kurssille. {{ENROLMENT_LINK}}", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000003", "attributes": {"content": "Tarkistamme tilanteen säännöllisesti ja kirjaamme opintopisteesi automaattisesti, kun näemme ilmoittautumisesi. Jos olet jo ilmoittautunut, sinun ei tarvitse tehdä muuta.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d4000000-0000-0000-0000-000000000004", "attributes": {"content": "Näet tarkemmat tiedot ja ilmoittautumisohjeet täältä: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
        ]'::jsonb
      ),
      (
        'credit_registration_registered'::email_template_type,
        'en',
        'Your credits have been registered',
        '[
          {"type": "core/paragraph", "isValid": true, "clientId": "d5000000-0000-0000-0000-000000000001", "attributes": {"content": "Hello, your credits for {{COURSE_NAME}} ({{CREDITS}} credits) are now registered in Sisu.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d5000000-0000-0000-0000-000000000002", "attributes": {"content": "If they were already registered, this email confirms it. You can see the details here: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
        ]'::jsonb
      ),
      (
        'credit_registration_registered'::email_template_type,
        'fi',
        'Opintopisteesi on kirjattu',
        '[
          {"type": "core/paragraph", "isValid": true, "clientId": "d6000000-0000-0000-0000-000000000001", "attributes": {"content": "Hei, kurssin {{COURSE_NAME}} opintopisteesi ({{CREDITS}} op) on nyt kirjattu Sisuun.", "drop_cap": false}, "innerBlocks": []},
          {"type": "core/paragraph", "isValid": true, "clientId": "d6000000-0000-0000-0000-000000000002", "attributes": {"content": "Jos ne oli jo kirjattu, tämä viesti vahvistaa sen. Näet tiedot täältä: {{STATUS_LINK}}", "drop_cap": false}, "innerBlocks": []}
        ]'::jsonb
      )
  ) AS seed(email_template_type, language, subject, content)
WHERE NOT EXISTS (
    SELECT 1
    FROM email_templates existing
    WHERE existing.email_template_type = seed.email_template_type
      AND existing.language = seed.language
      AND existing.course_id IS NULL
      AND existing.deleted_at IS NULL
  );

DROP TABLE course_module_suotar_realisations;

DROP TYPE credit_registration_error_code_old;

ALTER TABLE study_registry_student_number_conflicts
ADD FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE credit_registration_enrolment_check_outcomes
ADD FOREIGN KEY (course_module_id) REFERENCES course_modules(id);

ALTER TABLE credit_registration_enrolment_check_signals
ADD FOREIGN KEY (course_module_completion_id) REFERENCES course_module_completions(id);

ALTER TABLE course_modules DROP CONSTRAINT course_modules_one_credit_registration_path,
  ADD COLUMN register_eligible_new_completions_via_suotar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT course_modules_register_new_completions_requires_suotar CHECK (
    NOT register_eligible_new_completions_via_suotar
    OR enable_credit_registration_via_suotar
  );

COMMENT ON COLUMN course_modules.enable_credit_registration_via_suotar IS 'Whether the module takes part in credit registration via Suotar: the pipeline runs for it and its configuration is checked. It does not move completions onto that path by itself; only completions with register_credits_via_suotar set go there, and the rest stay with enable_registering_completion_to_uh_open_university, which may be on at the same time.';
COMMENT ON COLUMN course_modules.register_eligible_new_completions_via_suotar IS 'While on, a completion created for this module gets register_credits_via_suotar set if its student then holds a live verified_student_numbers row. Checked once at creation: completions made before it was turned on are not swept in, a student linked later is not re-checked, and turning it off affects only completions created afterwards. Set by hand only.';

COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Set at creation only when the module has register_eligible_new_completions_via_suotar on and the student holds a live verified_student_numbers row; otherwise changed by hand only. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. A row with this false is registered the old way end to end. Changing it by hand is safe only while no other registrar holds or may still send the completion.';
