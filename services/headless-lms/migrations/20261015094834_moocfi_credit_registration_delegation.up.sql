CREATE TYPE external_grading AS ENUM ('pass_fail', 'numeric');

COMMENT ON TYPE external_grading IS 'How a mooc.fi completion with no grade reads: as a pass on a pass_fail target, as unrecognised on a numeric one.';

ALTER TYPE credit_registration_admin_action_target
ADD VALUE IF NOT EXISTS 'external_credit_target';
ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'configure_external_credit_target';
ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'pause_external_credit_target';
ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'resume_external_credit_target';

CREATE TABLE external_credit_targets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  moocfi_course_id UUID NOT NULL,
  moocfi_course_slug VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  language_code VARCHAR(15) NOT NULL CHECK (
    language_code ~ '^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$'
  ),
  tiers INT4RANGE CHECK (NOT isempty(tiers)),
  uh_course_code VARCHAR(255) NOT NULL CHECK (TRIM(uh_course_code) <> ''),
  ects_credits REAL NOT NULL CHECK (ects_credits > 0),
  grading external_grading NOT NULL,
  enrolment_link TEXT,
  delegated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  enabled_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  paused_by_user_id UUID REFERENCES users(id),
  pause_reason TEXT,
  config_checked_at TIMESTAMP WITH TIME ZONE,
  checked_course_code VARCHAR(255),
  course_code_allowed BOOLEAN,
  course_code_rejection TEXT,
  config_check_message TEXT,
  last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  last_listed_at TIMESTAMP WITH TIME ZONE,
  last_listing_error credit_registration_error_code,
  consecutive_listing_failures INT NOT NULL DEFAULT 0 CHECK (consecutive_listing_failures >= 0),
  CONSTRAINT external_credit_targets_pause_pair CHECK (
    (paused_at IS NULL) = (paused_by_user_id IS NULL)
  ),
  CONSTRAINT external_credit_targets_check_result CHECK (
    config_checked_at IS NOT NULL
    OR course_code_allowed IS NULL
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON external_credit_targets FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_external_credit_targets_course_code ON external_credit_targets (moocfi_course_id, uh_course_code)
WHERE deleted_at IS NULL;

-- An exclusion constraint would need btree_gist for the UUID equality.
CREATE FUNCTION check_external_credit_target_tier_overlap() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NULL;
END IF;
-- Serializes writers of one mooc.fi course, so two concurrent inserts cannot both pass the check.
PERFORM pg_advisory_xact_lock(
  hashtextextended(
    'external_credit_targets:' || NEW.moocfi_course_id::text,
    0
  )
);
IF EXISTS (
  SELECT 1
  FROM external_credit_targets other
  WHERE other.moocfi_course_id = NEW.moocfi_course_id
    AND other.id <> NEW.id
    AND other.deleted_at IS NULL
    AND COALESCE(other.tiers, '(,)'::int4range) && COALESCE(NEW.tiers, '(,)'::int4range)
) THEN RAISE EXCEPTION 'tiers % overlap another live target of mooc.fi course %',
COALESCE(NEW.tiers::text, '(untiered)'),
NEW.moocfi_course_id USING ERRCODE = 'exclusion_violation',
CONSTRAINT = 'external_credit_targets_tier_overlap';
END IF;
RETURN NULL;
END $$;

COMMENT ON FUNCTION check_external_credit_target_tier_overlap() IS 'Refuses a live external_credit_targets row whose tiers overlap those of another live target of the same mooc.fi course, an untiered target covering every tier. Raises exclusion_violation naming external_credit_targets_tier_overlap, as the equivalent exclusion constraint would.';

CREATE CONSTRAINT TRIGGER external_credit_targets_tier_overlap
AFTER
INSERT
  OR
UPDATE OF moocfi_course_id,
  tiers,
  deleted_at ON external_credit_targets FOR EACH ROW EXECUTE FUNCTION check_external_credit_target_tier_overlap();

COMMENT ON TABLE external_credit_targets IS 'A mooc.fi course whose credits courses registers into the study registry, standing in for both course_modules and course_module_suotar_configurations for mooc.fi ledger rows. Each tier of a course maps to at most one live target, enforced by the external_credit_targets_tier_overlap trigger, so a completion registers one course code at most.';
COMMENT ON COLUMN external_credit_targets.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN external_credit_targets.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN external_credit_targets.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN external_credit_targets.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting a target withdraws its completions, cancelling their rows not yet submitted.';
COMMENT ON COLUMN external_credit_targets.moocfi_course_id IS 'The mooc.fi course the completions are stored on, which is the handler course when another course hands its completions to it. Never the slug, which can change.';
COMMENT ON COLUMN external_credit_targets.moocfi_course_slug IS 'The mooc.fi course slug, for links back to mooc.fi only.';
COMMENT ON COLUMN external_credit_targets.name IS 'The course name shown to students and admins, with a "mooc.fi: " prefix added by the UI.';
COMMENT ON COLUMN external_credit_targets.language_code IS 'Language of the mails about this target, and the attainment language for a completion that has none.';
COMMENT ON COLUMN external_credit_targets.tiers IS 'The completion tiers this target registers. NULL for an untiered course, which registers every completion; otherwise a completion whose tier is outside the range is not this target''s.';
COMMENT ON COLUMN external_credit_targets.uh_course_code IS 'The University of Helsinki course code the credits are registered under.';
COMMENT ON COLUMN external_credit_targets.ects_credits IS 'Credits registered per completion.';
COMMENT ON COLUMN external_credit_targets.grading IS 'Whether the course is graded pass/fail or numerically, which decides how a completion without a grade reads.';
COMMENT ON COLUMN external_credit_targets.enrolment_link IS 'Where a student with no usable enrolment is sent to enrol, usually the Open University course page.';
COMMENT ON COLUMN external_credit_targets.delegated_at IS 'The cutoff: completions dated at or after it are registered by courses, earlier ones by the mooc.fi pull. Must equal credit_registration_delegated_at of the mooc.fi course, and be the same on every live target of that course; a target with ledger rows must not have it changed.';
COMMENT ON COLUMN external_credit_targets.enabled_at IS 'When registration through this target was switched on. NULL keeps every phase away from it.';
COMMENT ON COLUMN external_credit_targets.paused_at IS 'When an admin paused the target. Pausing freezes its ledger rows where they stand rather than cancelling them.';
COMMENT ON COLUMN external_credit_targets.paused_by_user_id IS 'The admin who paused the target.';
COMMENT ON COLUMN external_credit_targets.pause_reason IS 'Why the target was paused, as the admin wrote it.';
COMMENT ON COLUMN external_credit_targets.config_checked_at IS 'When config-validation last asked Suotar about the course code.';
COMMENT ON COLUMN external_credit_targets.checked_course_code IS 'The course code course_code_allowed is a verdict on. Once uh_course_code changes, the verdict no longer applies.';
COMMENT ON COLUMN external_credit_targets.course_code_allowed IS 'Suotar''s last verdict on checked_course_code. NULL means never checked, which is not a failed check.';
COMMENT ON COLUMN external_credit_targets.course_code_rejection IS 'Suotar''s own reason for not accepting checked_course_code, quoted to operators. NULL unless course_code_allowed is false.';
COMMENT ON COLUMN external_credit_targets.config_check_message IS 'What the last configuration check found, for operators.';
COMMENT ON COLUMN external_credit_targets.last_listing_attempted_at IS 'When enrolment discovery last tried to list the course code''s enrolments for this target.';
COMMENT ON COLUMN external_credit_targets.last_listed_at IS 'When such a listing last succeeded.';
COMMENT ON COLUMN external_credit_targets.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course.';
COMMENT ON COLUMN external_credit_targets.consecutive_listing_failures IS 'Failed listing attempts since the last success.';

CREATE TABLE external_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  external_credit_target_id UUID NOT NULL REFERENCES external_credit_targets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  moocfi_completion_id UUID NOT NULL,
  moocfi_user_upstream_id INT NOT NULL,
  completion_date TIMESTAMP WITH TIME ZONE NOT NULL,
  completion_language VARCHAR(15),
  tier INT,
  eligible_for_ects BOOLEAN NOT NULL,
  raw_grade TEXT,
  passed BOOLEAN,
  grade INT CHECK (grade BETWEEN 0 AND 5),
  revised_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  upstream_checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  upstream_missing_at TIMESTAMP WITH TIME ZONE,
  registered_upstream_at TIMESTAMP WITH TIME ZONE,
  reported_at TIMESTAMP WITH TIME ZONE,
  report_claimed_until TIMESTAMP WITH TIME ZONE,
  report_attempt_count INT NOT NULL DEFAULT 0 CHECK (report_attempt_count >= 0),
  report_next_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  report_last_error TEXT,
  CONSTRAINT external_completions_grade_needs_passed CHECK (
    passed IS NOT NULL
    OR grade IS NULL
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON external_completions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_external_completions_completion_target ON external_completions (moocfi_completion_id, external_credit_target_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_external_completions_user_target ON external_completions (user_id, external_credit_target_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE external_completions IS 'A mooc.fi completion as courses last read it, one row per completion and the target its tier maps to. The subject of a mooc.fi ledger row, as course_module_completions is of a native one. Facts are copied from mooc.fi when the student opens the registration page and on re-check; mooc.fi stays the source of truth.';
COMMENT ON COLUMN external_completions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN external_completions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN external_completions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN external_completions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN external_completions.external_credit_target_id IS 'The target whose tier range admitted the completion when it was read. A tier later moved out of that range withdraws the row, and the completion gets a new row under the target now covering it.';
COMMENT ON COLUMN external_completions.user_id IS 'The courses account of the student, matched to mooc.fi by users.upstream_id.';
COMMENT ON COLUMN external_completions.moocfi_completion_id IS 'The completion''s id on mooc.fi, which report-back registers.';
COMMENT ON COLUMN external_completions.moocfi_user_upstream_id IS 'The student''s TMC user id, the key of the mooc.fi completion lookup. Stored so re-checks need no user token.';
COMMENT ON COLUMN external_completions.completion_date IS 'The effective completion date: mooc.fi''s completion_date, or its created_at when that is NULL, as mooc.fi''s pull cutoff reads it.';
COMMENT ON COLUMN external_completions.completion_language IS 'The completion language in mooc.fi''s form, such as fi_FI. NULL when mooc.fi has none.';
COMMENT ON COLUMN external_completions.tier IS 'The completion tier on a tiered course, NULL otherwise.';
COMMENT ON COLUMN external_completions.eligible_for_ects IS 'mooc.fi''s eligible_for_ects, with NULL stored as false.';
COMMENT ON COLUMN external_completions.raw_grade IS 'mooc.fi''s grade verbatim, a free string there, for the admin view. passed and grade are parsed from it.';
COMMENT ON COLUMN external_completions.passed IS 'Whether the parsed grade is a pass. NULL when the grade was not recognised, which keeps the row from registering until it is fixed on mooc.fi.';
COMMENT ON COLUMN external_completions.grade IS 'The numeric grade 0 to 5, NULL for a pass/fail or unrecognised grade.';
COMMENT ON COLUMN external_completions.revised_at IS 'When the completion''s facts as read from mooc.fi (date, language, tier, eligibility or grade) last changed. Unlike updated_at, not moved by a re-check that finds nothing new. The grade-improvement scan compares against it, through credit_registration_subjects.revised_at.';
COMMENT ON COLUMN external_completions.upstream_checked_at IS 'When mooc.fi last returned this completion. Import refuses a row whose check is too old.';
COMMENT ON COLUMN external_completions.upstream_missing_at IS 'When the lookup first stopped returning the completion, meaning it was deleted on mooc.fi. Cleared if it reappears. Withdraws the row while set.';
COMMENT ON COLUMN external_completions.registered_upstream_at IS 'When a registration of the completion by another mooc.fi organization was first seen. Withdraws the row: someone else registered it.';
COMMENT ON COLUMN external_completions.reported_at IS 'When mooc.fi was told we registered the completion, or our registration was found there already. Set once; a later grade improvement is not reported.';
COMMENT ON COLUMN external_completions.report_claimed_until IS 'Lease of the reporter now posting this completion. Must outlast a lookup plus a post, or two reporters could both post.';
COMMENT ON COLUMN external_completions.report_attempt_count IS 'Failed report-back attempts, which drive the backoff.';
COMMENT ON COLUMN external_completions.report_next_attempt_at IS 'When report-back may next try this completion.';
COMMENT ON COLUMN external_completions.report_last_error IS 'Why the last report-back attempt failed, for operators.';

DROP VIEW credit_registration_preconditions;
DROP VIEW credit_registration_registrable_completions;
DROP VIEW credit_registration_eligible_completions;
DROP VIEW credit_registration_active_course_modules;

ALTER TABLE credit_registrations
ALTER COLUMN course_module_completion_id DROP NOT NULL,
  ALTER COLUMN course_id DROP NOT NULL,
  ALTER COLUMN course_module_id DROP NOT NULL,
  ALTER COLUMN course_instance_id DROP NOT NULL,
  ADD COLUMN external_completion_id UUID REFERENCES external_completions(id),
  ADD COLUMN external_credit_target_id UUID REFERENCES external_credit_targets(id),
  ADD COLUMN subject_id UUID GENERATED ALWAYS AS (
    COALESCE(course_module_completion_id, external_completion_id)
  ) STORED NOT NULL,
  ADD COLUMN credit_unit_id UUID GENERATED ALWAYS AS (
    COALESCE(course_module_id, external_credit_target_id)
  ) STORED NOT NULL,
  ADD CONSTRAINT credit_registrations_one_subject CHECK (
    (
      course_module_completion_id IS NOT NULL
      AND course_id IS NOT NULL
      AND course_module_id IS NOT NULL
      AND course_instance_id IS NOT NULL
      AND external_completion_id IS NULL
      AND external_credit_target_id IS NULL
    )
    OR (
      course_module_completion_id IS NULL
      AND course_id IS NULL
      AND course_module_id IS NULL
      AND course_instance_id IS NULL
      AND external_completion_id IS NOT NULL
      AND external_credit_target_id IS NOT NULL
    )
  );

COMMENT ON TABLE credit_registrations IS 'The credit registration ledger: one row per attempt at registering one completion into the study registry via Suotar, either a course module completion or a mooc.fi completion (external_completions). Every state write goes through credit_registrations::transition, which stamps state_entered_at and appends an event row in the same transaction; nothing else may update state.';
COMMENT ON COLUMN credit_registrations.course_module_completion_id IS 'The completion being registered. NULL on a mooc.fi row.';
COMMENT ON COLUMN credit_registrations.course_id IS 'The course, denormalised from the completion so per-course reads need no join. NULL on a mooc.fi row.';
COMMENT ON COLUMN credit_registrations.course_module_id IS 'The module, which is what carries the per-module configuration and pause. NULL on a mooc.fi row.';
COMMENT ON COLUMN credit_registrations.course_instance_id IS 'The instance the completion was earned on. NULL on a mooc.fi row.';
COMMENT ON COLUMN credit_registrations.external_completion_id IS 'The mooc.fi completion being registered. NULL on a course module row.';
COMMENT ON COLUMN credit_registrations.external_credit_target_id IS 'The target that carries the configuration and pause of a mooc.fi row, as course_module_id does for a native one. NULL on a course module row.';
COMMENT ON COLUMN credit_registrations.subject_id IS 'The completion being registered, whichever kind it is. What every "same completion" comparison uses; ids of the two completion tables are random UUIDs and do not collide.';
COMMENT ON COLUMN credit_registrations.improvement_checked_completion_updated_at IS 'The completion''s credit_registration_subjects.revised_at as of the last time the grade-improvement scan judged this accepted attempt and found no improvement. A completion revised for any other reason keeps matching the scan''s cheap "changed since the attempt" pre-filter, so without this watermark those rows fill every capped batch and a real regrade further down the queue is never reached.';
COMMENT ON COLUMN credit_registrations.credit_unit_id IS 'The module or target the row registers for, whichever kind it is. What every "same unit" comparison and the pause gate use.';

DROP INDEX uq_credit_registrations_completion;
CREATE UNIQUE INDEX uq_credit_registrations_completion ON credit_registrations (subject_id)
WHERE deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state NOT IN ('registered', 'duplicate', 'not_improved');

DROP INDEX uq_credit_registrations_completion_attempt;
CREATE UNIQUE INDEX uq_credit_registrations_completion_attempt ON credit_registrations (subject_id, attempt_number)
WHERE deleted_at IS NULL;

DROP INDEX idx_credit_registrations_course_module;
CREATE INDEX idx_credit_registrations_course_module ON credit_registrations (credit_unit_id, state)
WHERE deleted_at IS NULL;

DROP INDEX idx_credit_registrations_module_created;
CREATE INDEX idx_credit_registrations_module_created ON credit_registrations (credit_unit_id, created_at DESC)
WHERE deleted_at IS NULL;

DROP INDEX idx_credit_registrations_module_error_code;
CREATE INDEX idx_credit_registrations_module_error_code ON credit_registrations (credit_unit_id, error_code)
WHERE error_code IS NOT NULL
  AND deleted_at IS NULL;

-- Keyed on the course code, not the module: Sisu holds one attainment per person per course unit,
-- and a mooc.fi credit and a native one for the same code must not both get there.
DROP INDEX uq_credit_registrations_person_module;
CREATE UNIQUE INDEX uq_credit_registrations_person_course_code ON credit_registrations (sisu_person_id, UPPER(TRIM(uh_course_code)))
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

ALTER TABLE credit_registration_enrolment_check_signals
ALTER COLUMN course_module_completion_id DROP NOT NULL,
  ADD COLUMN external_completion_id UUID REFERENCES external_completions(id),
  ADD CONSTRAINT credit_registration_enrolment_check_signals_one_subject CHECK (
    num_nonnulls(course_module_completion_id, external_completion_id) = 1
  );
DROP INDEX uq_credit_registration_enrolment_check_signals_completion;
CREATE UNIQUE INDEX uq_credit_registration_enrolment_check_signals_completion ON credit_registration_enrolment_check_signals (
  (
    COALESCE(course_module_completion_id, external_completion_id)
  ),
  deleted_at
) NULLS NOT DISTINCT;
COMMENT ON COLUMN credit_registration_enrolment_check_signals.course_module_completion_id IS 'The completion the signals are about. Unique among live rows. NULL when the signals are about a mooc.fi completion.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.external_completion_id IS 'The mooc.fi completion the signals are about. Unique among live rows. NULL when they are about a course module completion.';

ALTER TABLE credit_registration_enrolment_check_outcomes
ALTER COLUMN course_module_id DROP NOT NULL,
  ADD COLUMN external_credit_target_id UUID REFERENCES external_credit_targets(id),
  ADD CONSTRAINT credit_registration_enrolment_check_outcomes_one_unit CHECK (
    num_nonnulls(course_module_id, external_credit_target_id) = 1
  );
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.course_module_id IS 'The row''s module, kept so outcomes can be grouped by course without the ledger. NULL for a mooc.fi row.';
COMMENT ON COLUMN credit_registration_enrolment_check_outcomes.external_credit_target_id IS 'The mooc.fi row''s target, kept as course_module_id is for a native row. NULL for a native row.';

ALTER TABLE credit_registration_enrolment_routes
ALTER COLUMN course_module_completion_id DROP NOT NULL,
  ADD COLUMN external_completion_id UUID REFERENCES external_completions(id),
  ADD CONSTRAINT credit_registration_enrolment_routes_one_subject CHECK (
    num_nonnulls(course_module_completion_id, external_completion_id) = 1
  );
DROP INDEX uq_credit_registration_enrolment_routes_completion;
CREATE UNIQUE INDEX uq_credit_registration_enrolment_routes_completion ON credit_registration_enrolment_routes (
  (
    COALESCE(course_module_completion_id, external_completion_id)
  ),
  deleted_at
) NULLS NOT DISTINCT;
COMMENT ON COLUMN credit_registration_enrolment_routes.course_module_completion_id IS 'The completion the student answered about. Unique among live rows: the answer is replaced rather than versioned. NULL when the answer is about a mooc.fi completion.';
COMMENT ON COLUMN credit_registration_enrolment_routes.external_completion_id IS 'The mooc.fi completion the student answered about, under the same uniqueness as course_module_completion_id. NULL when the answer is about a course module completion.';

ALTER TABLE credit_registration_account_linking_emails
ALTER COLUMN course_id DROP NOT NULL,
  ADD COLUMN external_credit_target_id UUID REFERENCES external_credit_targets(id),
  ADD CONSTRAINT credit_registration_account_linking_emails_one_unit CHECK (
    num_nonnulls(course_id, external_credit_target_id) = 1
  );
DROP INDEX uq_account_linking_email_person_course_address;
CREATE UNIQUE INDEX uq_account_linking_email_person_course_address ON credit_registration_account_linking_emails (
  sisu_person_id,
  COALESCE(course_id, external_credit_target_id),
  LOWER(emailed_to)
)
WHERE deleted_at IS NULL
  AND replaced_at IS NULL;
COMMENT ON COLUMN credit_registration_account_linking_emails.course_id IS 'The course whose registration flow triggered the mail. NULL when a mooc.fi target''s did.';
COMMENT ON COLUMN credit_registration_account_linking_emails.external_credit_target_id IS 'The mooc.fi target whose registration flow triggered the mail, in place of course_id. Deduplicated as a course is.';

-- Each branch reads one table, with unit facts in scalar subqueries: a branch with a join is not
-- flattened into the union, and then a lookup by subject_id scans every completion.
CREATE VIEW credit_registration_subjects AS
SELECT cmc.id AS subject_id,
  'course_module'::text AS kind,
  cmc.user_id,
  cmc.course_module_id AS credit_unit_id,
  cmc.course_id,
  cmc.course_module_id,
  NULL::uuid AS external_credit_target_id,
  NULL::uuid AS external_completion_id,
  cmc.id AS course_module_completion_id,
  cmc.passed,
  cmc.grade,
  cmc.completion_date,
  cmc.completion_language,
  cmc.eligible_for_ects,
  cmc.passed
  AND cmc.eligible_for_ects
  AND cmc.prerequisite_modules_completed
  AND NOT cmc.needs_to_be_reviewed AS fully_eligible,
  cmc.deleted_at IS NOT NULL AS is_withdrawn,
  cmc.register_credits_via_suotar AS is_on_pipeline,
  cmc.created_at,
  cmc.updated_at,
  cmc.updated_at AS revised_at,
  (
    SELECT cm.uh_course_code
    FROM course_modules cm
    WHERE cm.id = cmc.course_module_id
  ) AS uh_course_code,
  (
    SELECT cm.ects_credits
    FROM course_modules cm
    WHERE cm.id = cmc.course_module_id
  ) AS ects_credits,
  (
    SELECT NULLIF(TRIM(cm.completion_registration_link_override), '')
    FROM course_modules cm
    WHERE cm.id = cmc.course_module_id
  ) AS enrolment_link,
  (
    SELECT c.language_code
    FROM courses c
    WHERE c.id = cmc.course_id
  ) AS language_code,
  (
    SELECT cm.name
    FROM course_modules cm
    WHERE cm.id = cmc.course_module_id
  ) AS unit_name,
  (
    SELECT c.name
    FROM courses c
    WHERE c.id = cmc.course_id
  ) AS course_name
FROM course_module_completions cmc
UNION ALL
SELECT ec.id AS subject_id,
  'mooc_fi'::text AS kind,
  ec.user_id,
  ec.external_credit_target_id AS credit_unit_id,
  NULL::uuid AS course_id,
  NULL::uuid AS course_module_id,
  ec.external_credit_target_id,
  ec.id AS external_completion_id,
  NULL::uuid AS course_module_completion_id,
  ec.passed,
  ec.grade,
  ec.completion_date,
  COALESCE(
    ec.completion_language,
    (
      SELECT t.language_code
      FROM external_credit_targets t
      WHERE t.id = ec.external_credit_target_id
    )
  ) AS completion_language,
  ec.eligible_for_ects,
  ec.passed IS TRUE
  AND ec.eligible_for_ects AS fully_eligible,
  ec.deleted_at IS NOT NULL
  OR ec.upstream_missing_at IS NOT NULL
  OR ec.registered_upstream_at IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
      AND (
        ec.completion_date < t.delegated_at
        OR t.deleted_at IS NOT NULL
        OR (
          t.tiers IS NOT NULL
          AND (t.tiers @> ec.tier) IS NOT TRUE
        )
      )
  ) AS is_withdrawn,
  TRUE AS is_on_pipeline,
  ec.created_at,
  ec.updated_at,
  ec.revised_at,
  (
    SELECT t.uh_course_code
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS uh_course_code,
  (
    SELECT t.ects_credits
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS ects_credits,
  (
    SELECT NULLIF(TRIM(t.enrolment_link), '')
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS enrolment_link,
  (
    SELECT t.language_code
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS language_code,
  (
    SELECT t.name
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS unit_name,
  NULL::varchar AS course_name
FROM external_completions ec;

COMMENT ON VIEW credit_registration_subjects IS 'Every completion a ledger row can register, course module completions and mooc.fi completions alike, with the facts of the completion and of the unit (module or target) it registers for. Ledger rows join it on subject_id.';
COMMENT ON COLUMN credit_registration_subjects.kind IS '''course_module'' or ''mooc_fi''.';
COMMENT ON COLUMN credit_registration_subjects.passed IS 'NULL for a mooc.fi completion whose grade was not recognised.';
COMMENT ON COLUMN credit_registration_subjects.fully_eligible IS 'Passed and ECTS-eligible, and for a course module completion also not waiting on a prerequisite module or a suspected-cheating review.';
COMMENT ON COLUMN credit_registration_subjects.is_withdrawn IS 'The completion is no longer ours to register: deleted, or for mooc.fi also gone upstream, registered by another organization, dated before the cutoff, on a deleted target, or with a tier outside the target''s range. Withdrawal cancels rows not yet submitted.';
COMMENT ON COLUMN credit_registration_subjects.is_on_pipeline IS 'Registered by this pipeline rather than the pull path. Always true for mooc.fi completions: the pull already excludes everything at or after the cutoff.';
COMMENT ON COLUMN credit_registration_subjects.revised_at IS 'When the completion last changed in a way that could matter to its registration. For a course module completion its updated_at.';
COMMENT ON COLUMN credit_registration_subjects.course_name IS 'NULL for a mooc.fi completion; unit_name names it.';

CREATE VIEW credit_registration_active_units AS
SELECT cm.id AS credit_unit_id,
  cm.course_id,
  NULL::uuid AS external_credit_target_id,
  cm.uh_course_code
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE TRIM(cm.uh_course_code) <> ''
  AND cm.deleted_at IS NULL
  AND conf.paused_at IS NULL
UNION ALL
SELECT t.id AS credit_unit_id,
  NULL::uuid AS course_id,
  t.id AS external_credit_target_id,
  t.uh_course_code
FROM external_credit_targets t
WHERE t.enabled_at IS NOT NULL
  AND t.paused_at IS NULL
  AND t.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_active_units IS 'Modules with a course code and enabled mooc.fi targets that are not paused. The gate every phase that spends work on a unit shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

CREATE VIEW credit_registration_eligible_completions AS
SELECT s.course_module_completion_id,
  s.user_id,
  s.course_id,
  s.course_module_id,
  s.completion_date,
  s.created_at,
  s.fully_eligible,
  s.subject_id,
  s.kind,
  s.credit_unit_id,
  s.external_completion_id,
  s.external_credit_target_id
FROM credit_registration_subjects s
  LEFT JOIN course_modules cm ON cm.id = s.course_module_id
WHERE s.is_on_pipeline
  AND NOT s.is_withdrawn
  AND s.passed IS TRUE
  AND s.eligible_for_ects
  AND TRIM(s.uh_course_code) <> ''
  AND cm.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live unit with a course code, and on the pipeline. For a course module completion that is the push-path mark set at creation; the pull path excludes exactly the rows carrying it. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
COMMENT ON COLUMN credit_registration_eligible_completions.fully_eligible IS 'False while the completion still waits on a prerequisite module or on a suspected-cheating review.';

CREATE VIEW credit_registration_registrable_completions AS
SELECT e.*
FROM credit_registration_eligible_completions e
WHERE NOT EXISTS (
    SELECT 1
    FROM credit_registrations cr
    WHERE cr.subject_id = e.subject_id
      AND cr.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM course_module_completion_registered_to_study_registries r
    WHERE r.course_module_completion_id = e.course_module_completion_id
      AND r.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM external_completions ec
    WHERE ec.id = e.external_completion_id
      AND ec.reported_at IS NOT NULL
  );

COMMENT ON VIEW credit_registration_registrable_completions IS 'Eligible completions that have no ledger row and are not already in the study registry through the pull path or reported to mooc.fi as registered. Exactly the rows the materialiser creates a registration for, and so exactly the rows it may be accused of having missed. fully_eligible is not applied here: a completion still waiting on a prerequisite gets its row and waits in pending.';

CREATE VIEW credit_registration_preconditions AS
SELECT cr.id AS credit_registration_id,
  s.is_withdrawn,
  NOT s.is_withdrawn
  AND s.fully_eligible AS completion_eligible,
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
      AND conf.checked_course_code = TRIM(s.uh_course_code)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM external_credit_targets t
    WHERE t.id = cr.external_credit_target_id
      AND NOT t.course_code_allowed
      AND t.checked_course_code = TRIM(t.uh_course_code)
  ) AS course_code_allowed,
  s.passed IS NULL AS grade_unrecognised,
  s.subject_id
FROM credit_registrations cr
  JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_preconditions IS 'The things one ledger row waits on, as they stand right now. The ledger records only that a row is pending, so this is where every surface that names the blocker, and the precondition recompute that acts on it, read the same answer.';
COMMENT ON COLUMN credit_registration_preconditions.is_withdrawn IS 'See credit_registration_subjects.is_withdrawn.';
COMMENT ON COLUMN credit_registration_preconditions.frozen_identity_stale IS 'The account has relinked to a different verified student number since this row froze its payload for import. A relink soft-deletes and re-inserts in one transaction, so has_verified_student_number stays true throughout and catches none of it.';
COMMENT ON COLUMN credit_registration_preconditions.course_code_allowed IS 'False while Suotar''s last verdict on the unit''s current course code says it does not accept it; true once it does, or when there is no verdict. Rows wait in pending while false, since every import would come back courseNotAllowed.';
COMMENT ON COLUMN credit_registration_preconditions.grade_unrecognised IS 'The mooc.fi grade could not be parsed, so completion_eligible is false until it is fixed on mooc.fi. Always false for a course module completion.';

CREATE INDEX idx_external_completions_report_due ON external_completions (report_next_attempt_at)
WHERE reported_at IS NULL
  AND deleted_at IS NULL;

ALTER TYPE credit_registration_attention_reason
ADD VALUE IF NOT EXISTS 'report_back_overdue';

INSERT INTO credit_registration_phase_state (phase, process_name, expected_interval_secs)
VALUES ('moocfi-recheck', 'credit-registrar', 300),
  ('moocfi-report', 'credit-registrar', 60);
