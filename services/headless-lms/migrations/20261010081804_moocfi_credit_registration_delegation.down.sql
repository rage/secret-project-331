DELETE FROM credit_registration_phase_state
WHERE phase IN ('moocfi-recheck', 'moocfi-report');

DROP VIEW credit_registration_preconditions;
DROP VIEW credit_registration_registrable_completions;
DROP VIEW credit_registration_eligible_completions;
DROP VIEW credit_registration_active_units;
DROP VIEW credit_registration_subjects;

-- Everything about mooc.fi rows goes; the restored NOT NULL columns have nothing to hold for them.
DELETE FROM credit_registration_account_linking_emails
WHERE external_credit_target_id IS NOT NULL;
DELETE FROM credit_registration_enrolment_routes
WHERE external_completion_id IS NOT NULL;
DELETE FROM credit_registration_enrolment_check_signals
WHERE external_completion_id IS NOT NULL;
DELETE FROM credit_registration_enrolment_check_outcomes
WHERE external_credit_target_id IS NOT NULL
  OR credit_registration_id IN (
    SELECT id
    FROM credit_registrations
    WHERE external_completion_id IS NOT NULL
  );
DELETE FROM credit_registration_attention_dismissals
WHERE credit_registration_id IN (
    SELECT id
    FROM credit_registrations
    WHERE external_completion_id IS NOT NULL
  );
DELETE FROM credit_registration_events
WHERE credit_registration_id IN (
    SELECT id
    FROM credit_registrations
    WHERE external_completion_id IS NOT NULL
  );
UPDATE credit_registrations
SET pending_superseded_by_id = NULL
WHERE pending_superseded_by_id IN (
    SELECT id
    FROM credit_registrations
    WHERE external_completion_id IS NOT NULL
  );
UPDATE credit_registrations
SET superseded_by_id = NULL,
  superseded_at = NULL
WHERE superseded_by_id IN (
    SELECT id
    FROM credit_registrations
    WHERE external_completion_id IS NOT NULL
  );
DELETE FROM credit_registrations
WHERE external_completion_id IS NOT NULL;

DROP INDEX uq_account_linking_email_person_course_address;
ALTER TABLE credit_registration_account_linking_emails DROP CONSTRAINT credit_registration_account_linking_emails_one_unit,
  DROP COLUMN external_credit_target_id,
  ALTER COLUMN course_id
SET NOT NULL;
CREATE UNIQUE INDEX uq_account_linking_email_person_course_address ON credit_registration_account_linking_emails (sisu_person_id, course_id, LOWER(emailed_to))
WHERE deleted_at IS NULL
  AND replaced_at IS NULL;
COMMENT ON COLUMN credit_registration_account_linking_emails.course_id IS 'The course whose registration flow triggered the mail.';

DROP INDEX uq_credit_registration_enrolment_routes_completion;
ALTER TABLE credit_registration_enrolment_routes DROP CONSTRAINT credit_registration_enrolment_routes_one_subject,
  DROP COLUMN external_completion_id,
  ALTER COLUMN course_module_completion_id
SET NOT NULL;
CREATE UNIQUE INDEX uq_credit_registration_enrolment_routes_completion ON credit_registration_enrolment_routes (course_module_completion_id, deleted_at) NULLS NOT DISTINCT;
COMMENT ON COLUMN credit_registration_enrolment_routes.course_module_completion_id IS 'The completion the student answered about. Unique among live rows: the answer is replaced rather than versioned.';

ALTER TABLE credit_registration_enrolment_check_outcomes DROP CONSTRAINT credit_registration_enrolment_check_outcomes_one_unit,
  DROP COLUMN external_credit_target_id,
  ALTER COLUMN course_module_id
SET NOT NULL;
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.course_module_id IS 'The row''s module, kept so outcomes can be grouped by course without the ledger.';

DROP INDEX uq_credit_registration_enrolment_check_signals_completion;
ALTER TABLE credit_registration_enrolment_check_signals DROP CONSTRAINT credit_registration_enrolment_check_signals_one_subject,
  DROP COLUMN external_completion_id,
  ALTER COLUMN course_module_completion_id
SET NOT NULL;
CREATE UNIQUE INDEX uq_credit_registration_enrolment_check_signals_completion ON credit_registration_enrolment_check_signals (course_module_completion_id, deleted_at) NULLS NOT DISTINCT;
COMMENT ON COLUMN credit_registration_enrolment_check_signals.course_module_completion_id IS 'The completion the signals are about. Unique among live rows.';

DROP INDEX uq_credit_registrations_person_course_code;
DROP INDEX uq_credit_registrations_completion;
DROP INDEX uq_credit_registrations_completion_attempt;
DROP INDEX idx_credit_registrations_course_module;
DROP INDEX idx_credit_registrations_module_created;
DROP INDEX idx_credit_registrations_module_error_code;

ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_one_subject,
  DROP COLUMN subject_id,
  DROP COLUMN credit_unit_id,
  DROP COLUMN external_completion_id,
  DROP COLUMN external_credit_target_id,
  ALTER COLUMN course_module_completion_id
SET NOT NULL,
  ALTER COLUMN course_id
SET NOT NULL,
  ALTER COLUMN course_module_id
SET NOT NULL,
  ALTER COLUMN course_instance_id
SET NOT NULL;

CREATE UNIQUE INDEX uq_credit_registrations_completion ON credit_registrations (course_module_completion_id)
WHERE deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state NOT IN ('registered', 'duplicate', 'not_improved');
CREATE UNIQUE INDEX uq_credit_registrations_completion_attempt ON credit_registrations (course_module_completion_id, attempt_number)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_course_module ON credit_registrations (course_module_id, state)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_created ON credit_registrations (course_module_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_error_code ON credit_registrations (course_module_id, error_code)
WHERE error_code IS NOT NULL
  AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND pending_superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'partially_registered',
    'registered',
    'duplicate',
    'not_improved'
  );

COMMENT ON TABLE credit_registrations IS 'The credit registration ledger: one row per attempt at registering one course module completion into the study registry via Suotar. Every state write goes through credit_registrations::transition, which stamps state_entered_at and appends an event row in the same transaction; nothing else may update state.';
COMMENT ON COLUMN credit_registrations.course_module_completion_id IS 'The completion being registered.';
COMMENT ON COLUMN credit_registrations.course_id IS 'The course, denormalised from the completion so per-course reads need no join.';
COMMENT ON COLUMN credit_registrations.course_module_id IS 'The module, which is what carries the per-module configuration and pause.';
COMMENT ON COLUMN credit_registrations.course_instance_id IS 'The instance the completion was earned on.';
COMMENT ON COLUMN credit_registrations.improvement_checked_completion_updated_at IS 'The completion''s updated_at as of the last time the grade-improvement scan judged this accepted attempt and found no improvement. A completion touched for any other reason keeps matching the scan''s cheap "changed since the attempt" pre-filter, so without this watermark those rows fill every capped batch and a real regrade further down the queue is never reached.';

DROP TABLE external_completions;
DROP TABLE external_credit_targets;
DROP FUNCTION check_external_credit_target_tier_overlap();
DROP TYPE external_grading;

-- The enum values the up migration added cannot be dropped, so they stay.

CREATE VIEW credit_registration_eligible_completions AS
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
WHERE cmc.register_credits_via_suotar
  AND cm.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module, and marked for the push path when they were created. Marked, not on a module opted in now: the flag is frozen at creation and the pull path excludes exactly the rows carrying it, so demanding the module''s flag as well would strand a completion between the two paths. Turning the module off instead pauses these rows, in claim_due. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
COMMENT ON COLUMN credit_registration_eligible_completions.fully_eligible IS 'False while the completion still waits on a prerequisite module or on a suspected-cheating review.';

CREATE VIEW credit_registration_registrable_completions AS
SELECT e.*
FROM credit_registration_eligible_completions e
WHERE NOT EXISTS (
    SELECT 1
    FROM credit_registrations cr
    WHERE cr.course_module_completion_id = e.course_module_completion_id
      AND cr.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM course_module_completion_registered_to_study_registries r
    WHERE r.course_module_completion_id = e.course_module_completion_id
      AND r.deleted_at IS NULL
  );

COMMENT ON VIEW credit_registration_registrable_completions IS 'Eligible completions that have no ledger row and are not already in the study registry through the pull path. Exactly the rows the materialiser creates a registration for, and so exactly the rows it may be accused of having missed. fully_eligible is not applied here: a completion still waiting on a prerequisite gets its row and waits in pending.';

CREATE VIEW credit_registration_preconditions AS
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

COMMENT ON VIEW credit_registration_preconditions IS 'The things one ledger row waits on, as they stand right now. The ledger records only that a row is pending, so this is where every surface that names the blocker, and the precondition recompute that acts on it, read the same answer.';
COMMENT ON COLUMN credit_registration_preconditions.frozen_identity_stale IS 'The account has relinked to a different verified student number since this row froze its payload for import. A relink soft-deletes and re-inserts in one transaction, so has_verified_student_number stays true throughout and catches none of it.';
COMMENT ON COLUMN credit_registration_preconditions.course_code_allowed IS 'False while Suotar''s last verdict on the module''s current course code says it does not accept it; true once it does, or when there is no verdict. Rows wait in pending while false, since every import would come back courseNotAllowed.';

CREATE VIEW credit_registration_active_course_modules AS
SELECT cm.id AS course_module_id,
  cm.course_id
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND conf.paused_at IS NULL;

COMMENT ON VIEW credit_registration_active_course_modules IS 'Modules whose credit registration is switched on and not paused. The gate every phase that spends work on a module shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';
