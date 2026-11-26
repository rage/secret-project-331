DROP VIEW moocfi_reportable_registrations;
DROP VIEW credit_registration_preconditions;
DROP FUNCTION credit_registration_prerequisite_met(credit_registrations);
DROP TABLE credit_registration_sisu_code_checks;
DROP VIEW credit_registration_registrable_completions;
DROP VIEW credit_registration_eligible_completions;
DROP VIEW credit_registration_active_units;
DROP VIEW credit_registration_subjects;
DROP FUNCTION moocfi_registered_equivalent(external_completions);
DROP INDEX uq_external_credit_targets_moocfi_course;

-- A target with several codes keeps only the lowest-tier one; completions and ledger rows of the
-- others go back to pointing at the target alone.
ALTER TABLE external_credit_targets
ADD COLUMN tiers INT4RANGE CHECK (NOT isempty(tiers)),
  ADD COLUMN uh_course_code VARCHAR(255),
  ADD COLUMN ects_credits REAL,
  ADD COLUMN grading external_grading,
  ADD COLUMN enrolment_link TEXT,
  ADD COLUMN config_checked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN checked_course_code VARCHAR(255),
  ADD COLUMN course_code_allowed BOOLEAN,
  ADD COLUMN course_code_rejection TEXT,
  ADD COLUMN config_check_message TEXT,
  ADD COLUMN last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listing_error credit_registration_error_code,
  ADD COLUMN consecutive_listing_failures INT NOT NULL DEFAULT 0 CHECK (consecutive_listing_failures >= 0);
UPDATE external_credit_targets t
SET tiers = CASE
    WHEN code.minimum_tier IS NOT NULL THEN int4range(code.minimum_tier, NULL, '[)')
  END,
  uh_course_code = code.uh_course_code,
  ects_credits = code.ects_credits,
  grading = code.grading,
  enrolment_link = code.enrolment_link,
  config_checked_at = code.config_checked_at,
  checked_course_code = code.checked_course_code,
  course_code_allowed = code.course_code_allowed,
  course_code_rejection = code.course_code_rejection,
  config_check_message = code.config_check_message,
  last_listing_attempted_at = code.last_listing_attempted_at,
  last_listed_at = code.last_listed_at,
  last_listing_error = code.last_listing_error,
  consecutive_listing_failures = code.consecutive_listing_failures
FROM (
    SELECT DISTINCT ON (external_credit_target_id) *
    FROM external_credit_target_codes
    ORDER BY external_credit_target_id,
      deleted_at NULLS FIRST,
      minimum_tier NULLS FIRST,
      created_at
  ) code
WHERE code.external_credit_target_id = t.id;
UPDATE external_credit_targets
SET uh_course_code = 'UNKNOWN',
  ects_credits = 1,
  grading = 'pass_fail'
WHERE uh_course_code IS NULL;
ALTER TABLE external_credit_targets
ALTER COLUMN uh_course_code
SET NOT NULL,
  ALTER COLUMN ects_credits
SET NOT NULL,
  ALTER COLUMN grading
SET NOT NULL,
  ADD CONSTRAINT external_credit_targets_uh_course_code_check CHECK (TRIM(uh_course_code) <> ''),
  ADD CONSTRAINT external_credit_targets_ects_credits_check CHECK (ects_credits > 0),
  ADD CONSTRAINT external_credit_targets_check_result CHECK (
    config_checked_at IS NOT NULL
    OR course_code_allowed IS NULL
  );

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

COMMENT ON TABLE external_credit_targets IS 'A mooc.fi course whose credits courses registers into the study registry, standing in for both course_modules and course_module_suotar_configurations for mooc.fi ledger rows. Each tier of a course maps to at most one live target, enforced by the external_credit_targets_tier_overlap trigger, so a completion registers one course code per tier it has had.';
COMMENT ON COLUMN external_credit_targets.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting a target withdraws its completions, cancelling their rows not yet submitted.';
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

DROP INDEX idx_credit_registrations_course_module;
DROP INDEX idx_credit_registrations_module_created;
DROP INDEX idx_credit_registrations_module_error_code;
ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_one_subject,
  DROP CONSTRAINT credit_registrations_code_of_target,
  DROP COLUMN credit_unit_id,
  DROP COLUMN external_credit_target_code_id;
ALTER TABLE credit_registrations
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
CREATE INDEX idx_credit_registrations_course_module ON credit_registrations (credit_unit_id, state)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_created ON credit_registrations (credit_unit_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_error_code ON credit_registrations (credit_unit_id, error_code)
WHERE error_code IS NOT NULL
  AND deleted_at IS NULL;
COMMENT ON COLUMN credit_registrations.external_credit_target_id IS 'The target that carries the configuration and pause of a mooc.fi row, as course_module_id does for a native one. NULL on a course module row.';
COMMENT ON COLUMN credit_registrations.credit_unit_id IS 'The module or target the row registers for, whichever kind it is. What every "same unit" comparison and the pause gate use.';

DROP INDEX uq_external_completions_completion_code;
-- Rows of the dropped codes would collide with the kept code's on the restored index.
UPDATE external_completions ec
SET deleted_at = now()
WHERE ec.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM external_completions other
    WHERE other.moocfi_completion_id = ec.moocfi_completion_id
      AND other.external_credit_target_id = ec.external_credit_target_id
      AND other.deleted_at IS NULL
      AND other.id < ec.id
  );
ALTER TABLE external_completions DROP CONSTRAINT external_completions_code_of_target,
  DROP COLUMN external_credit_target_code_id;
CREATE UNIQUE INDEX uq_external_completions_completion_target ON external_completions (moocfi_completion_id, external_credit_target_id)
WHERE deleted_at IS NULL;
COMMENT ON TABLE external_completions IS 'A mooc.fi completion as courses last read it, one row per completion and the target its tier maps to. The subject of a mooc.fi ledger row, as course_module_completions is of a native one. Facts are copied from mooc.fi when the student opens the registration page and on re-check; mooc.fi stays the source of truth.';
COMMENT ON COLUMN external_completions.external_credit_target_id IS 'The target whose tier range admitted the completion when it was read. A tier later moved out of that range withdraws the row, and the completion gets a new row under the target now covering it.';
COMMENT ON COLUMN external_completions.passed IS 'Whether the parsed grade is a pass. NULL when the grade was not recognised, which keeps the row from registering until it is fixed on mooc.fi.';
COMMENT ON COLUMN external_completions.registered_upstream_at IS 'When a registration of the completion by another mooc.fi organization was first seen. Withdraws the row: someone else registered it.';
COMMENT ON COLUMN external_completions.reported_at IS 'When a registration of the completion by our organization was first on mooc.fi, reported by us or found there. Set once. Keeps a completion registered before delegation from getting a ledger row, though not one whose tier moved after we registered it under another target; which registrations were reported is in moocfi_registration_reports.';

DROP TABLE external_credit_target_codes;

CREATE FUNCTION moocfi_registered_equivalent(completion external_completions) RETURNS UUID LANGUAGE sql STABLE AS $$
SELECT earlier.moocfi_completion_id
FROM external_completions earlier
  JOIN external_credit_targets earlier_target ON earlier_target.id = earlier.external_credit_target_id
  JOIN external_credit_targets target ON target.id = completion.external_credit_target_id
WHERE earlier.user_id = completion.user_id
  AND earlier_target.moocfi_course_id = target.moocfi_course_id
  AND earlier.moocfi_completion_id <> completion.moocfi_completion_id
  AND earlier.completion_date <= completion.completion_date
  AND earlier.deleted_at IS NULL
  AND earlier.upstream_missing_at IS NULL
  AND earlier.tier IS NOT DISTINCT FROM completion.tier
  AND moocfi_comparable_grade(earlier) IS NOT DISTINCT FROM moocfi_comparable_grade(completion)
  AND (
    earlier.registered_upstream_at IS NOT NULL
    OR earlier.reported_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM credit_registrations cr
      WHERE cr.external_completion_id = earlier.id
        AND cr.deleted_at IS NULL
        AND cr.state IN ('registered', 'duplicate', 'not_improved')
    )
  )
  AND completion.registered_upstream_at IS NULL
  AND completion.reported_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM external_completions own
      JOIN credit_registrations cr ON cr.external_completion_id = own.id
    WHERE own.moocfi_completion_id = completion.moocfi_completion_id
      AND cr.deleted_at IS NULL
      AND cr.state IN ('registered', 'duplicate', 'not_improved')
  )
ORDER BY earlier.completion_date,
  earlier.moocfi_completion_id
LIMIT 1 $$;

COMMENT ON FUNCTION moocfi_registered_equivalent(external_completions) IS 'The mooc.fi id of an equivalent of the completion that is already registered, which courses must not register again: an earlier completion of the same mooc.fi course by the same student with the same tier and grade, registered on mooc.fi by any organization or by a success of ours not yet reported. Grades compare by moocfi_comparable_grade. One dated the same moment counts as earlier. NULL when there is none, or when the completion is registered itself.';

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
  NULL::uuid AS registered_equivalent_moocfi_completion_id,
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
  OR moocfi_registered_equivalent(ec) IS NOT NULL
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
  moocfi_registered_equivalent(ec) AS registered_equivalent_moocfi_completion_id,
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
COMMENT ON COLUMN credit_registration_subjects.is_withdrawn IS 'The completion is no longer ours to register: deleted, or for mooc.fi also gone upstream, registered by another organization or through a registered equivalent, dated before the cutoff, on a deleted target, or with a tier outside the target''s range. Withdrawal cancels rows not yet submitted.';
COMMENT ON COLUMN credit_registration_subjects.is_on_pipeline IS 'Registered by this pipeline rather than the pull path. Always true for mooc.fi completions: the pull already excludes everything at or after the cutoff.';
COMMENT ON COLUMN credit_registration_subjects.registered_equivalent_moocfi_completion_id IS 'See moocfi_registered_equivalent. Always NULL for a course module completion.';
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
  AND cm.credit_registration_route = 'platform'
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

COMMENT ON VIEW credit_registration_active_units IS 'Modules with a course code and credit_registration_route platform, and enabled mooc.fi targets, that are not paused. The gate every phase that spends work on a unit shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

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
  AND cm.deleted_at IS NULL
  AND (cm.credit_registration_route = 'platform') IS NOT FALSE;

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
      AND NOT EXISTS (
        SELECT 1
        FROM external_completions sibling
          JOIN credit_registrations sibling_cr ON sibling_cr.external_completion_id = sibling.id
        WHERE sibling.moocfi_completion_id = ec.moocfi_completion_id
          AND sibling.id <> ec.id
      )
  );

COMMENT ON VIEW credit_registration_registrable_completions IS 'Eligible completions that have no ledger row and are not already in the study registry through the pull path or reported to mooc.fi as registered. A registration by us on mooc.fi does not count when a ledger row of ours for the completion under another target, left by a tier change, can have made it. Exactly the rows the materialiser creates a registration for, and so exactly the rows it may be accused of having missed. fully_eligible is not applied here: a completion still waiting on a prerequisite gets its row and waits in pending.';

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

CREATE VIEW moocfi_reportable_registrations AS
SELECT cr.id AS credit_registration_id,
  cr.external_completion_id,
  ec.moocfi_completion_id,
  COALESCE(cr.registered_at, cr.terminal_at, cr.state_entered_at) AS registration_date
FROM credit_registrations cr
  JOIN external_completions ec ON ec.id = cr.external_completion_id
WHERE cr.deleted_at IS NULL
  AND ec.deleted_at IS NULL
  AND cr.student_number IS NOT NULL
  AND (
    cr.state = 'registered'
    OR (
      cr.state IN ('duplicate', 'not_improved')
      AND NOT EXISTS (
        SELECT 1
        FROM external_completions earlier_ec
          JOIN credit_registrations earlier ON earlier.subject_id = earlier_ec.id
        WHERE earlier_ec.moocfi_completion_id = ec.moocfi_completion_id
          AND earlier.id <> cr.id
          AND earlier.state IN ('registered', 'duplicate', 'not_improved')
          AND (
            earlier.deleted_at IS NULL
            OR EXISTS (
              SELECT 1
              FROM moocfi_registration_reports earlier_report
              WHERE earlier_report.credit_registration_id = earlier.id
                AND earlier_report.reported_at IS NOT NULL
            )
          )
          AND (
            COALESCE(
              earlier.registered_at,
              earlier.terminal_at,
              earlier.state_entered_at
            ),
            earlier.id
          ) < (
            COALESCE(cr.registered_at, cr.terminal_at, cr.state_entered_at),
            cr.id
          )
      )
    )
  );

COMMENT ON VIEW moocfi_reportable_registrations IS 'The mooc.fi ledger rows that report-back tells mooc.fi about, one report each, since mooc.fi keeps every registration of a completion as history. Every registered row, a later grade improvement included. A duplicate or not_improved row puts nothing new in Sisu, so it is reported only when it is the first success of its mooc.fi completion: mooc.fi must still learn that the completion is registered. An earlier success deleted since still counts if it was reported.';
COMMENT ON COLUMN moocfi_reportable_registrations.registration_date IS 'When the credit landed in the study registry. What moocfi_registration_reports.registration_date is fixed from.';

