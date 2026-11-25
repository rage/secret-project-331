CREATE TABLE external_credit_target_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  external_credit_target_id UUID NOT NULL REFERENCES external_credit_targets(id),
  name VARCHAR(255) NOT NULL CHECK (TRIM(name) <> ''),
  uh_course_code VARCHAR(255) NOT NULL CHECK (TRIM(uh_course_code) <> ''),
  minimum_tier INT,
  ects_credits REAL NOT NULL CHECK (ects_credits > 0),
  grading external_grading NOT NULL,
  enrolment_link TEXT,
  prerequisite_code_id UUID,
  equivalent_course_codes TEXT [] NOT NULL DEFAULT '{}',
  config_checked_at TIMESTAMP WITH TIME ZONE,
  checked_course_code VARCHAR(255),
  course_code_allowed BOOLEAN,
  course_code_rejection TEXT,
  config_check_message TEXT,
  last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  last_listed_at TIMESTAMP WITH TIME ZONE,
  last_listing_error credit_registration_error_code,
  consecutive_listing_failures INT NOT NULL DEFAULT 0 CHECK (consecutive_listing_failures >= 0),
  CONSTRAINT external_credit_target_codes_id_target UNIQUE (id, external_credit_target_id),
  CONSTRAINT external_credit_target_codes_prerequisite_same_target FOREIGN KEY (prerequisite_code_id, external_credit_target_id) REFERENCES external_credit_target_codes (id, external_credit_target_id),
  CONSTRAINT external_credit_target_codes_not_own_prerequisite CHECK (prerequisite_code_id <> id),
  CONSTRAINT external_credit_target_codes_check_result CHECK (
    config_checked_at IS NOT NULL
    OR course_code_allowed IS NULL
  )
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON external_credit_target_codes FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_external_credit_target_codes_course_code ON external_credit_target_codes (external_credit_target_id, UPPER(TRIM(uh_course_code)))
WHERE deleted_at IS NULL;

COMMENT ON TABLE external_credit_target_codes IS 'A University of Helsinki course code a mooc.fi target registers credits under: the credit unit of a mooc.fi ledger row, as a course module is of a native one. A completion gets a ledger row for every live code of its target whose minimum tier it reaches, each with its own enrolment check and registration.';
COMMENT ON COLUMN external_credit_target_codes.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN external_credit_target_codes.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN external_credit_target_codes.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN external_credit_target_codes.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting a code withdraws its completions, cancelling their rows not yet submitted.';
COMMENT ON COLUMN external_credit_target_codes.external_credit_target_id IS 'The mooc.fi course the code belongs to, whose cutoff, enabling and pause apply to it.';
COMMENT ON COLUMN external_credit_target_codes.name IS 'The name students see for the credits registered under the code, such as the course name and its level.';
COMMENT ON COLUMN external_credit_target_codes.uh_course_code IS 'The University of Helsinki course code the credits are registered under. Unique among the target''s live codes.';
COMMENT ON COLUMN external_credit_target_codes.minimum_tier IS 'The lowest completion tier that earns the code, so a higher tier earns every code below it too. NULL for a code every completion earns, tiered or not.';
COMMENT ON COLUMN external_credit_target_codes.ects_credits IS 'Credits registered per completion.';
COMMENT ON COLUMN external_credit_target_codes.grading IS 'Whether the course is graded pass/fail or numerically, which decides how a completion without a grade reads.';
COMMENT ON COLUMN external_credit_target_codes.enrolment_link IS 'Where a student with no usable enrolment on this code is sent to enrol, usually the Open University course page.';
COMMENT ON COLUMN external_credit_target_codes.prerequisite_code_id IS 'A code of the same target the student must have in Sisu before this one is sent there. Rows wait in checking_enrolment until they do; see credit_registration_prerequisite_met.';
COMMENT ON COLUMN external_credit_target_codes.equivalent_course_codes IS 'Older course codes an attainment of which counts as holding this code: resolve-enrolments settles a row as already in Sisu when Sisu holds any of them, and they meet this code when it is another code''s prerequisite.';
COMMENT ON COLUMN external_credit_target_codes.config_checked_at IS 'When config-validation last asked Suotar about the course code.';
COMMENT ON COLUMN external_credit_target_codes.checked_course_code IS 'The course code course_code_allowed is a verdict on. Once uh_course_code changes, the verdict no longer applies.';
COMMENT ON COLUMN external_credit_target_codes.course_code_allowed IS 'Suotar''s last verdict on checked_course_code. NULL means never checked, which is not a failed check.';
COMMENT ON COLUMN external_credit_target_codes.course_code_rejection IS 'Suotar''s own reason for not accepting checked_course_code, quoted to operators. NULL unless course_code_allowed is false.';
COMMENT ON COLUMN external_credit_target_codes.config_check_message IS 'What the last configuration check found, for operators.';
COMMENT ON COLUMN external_credit_target_codes.last_listing_attempted_at IS 'When enrolment discovery last tried to list the course code''s enrolments for this code.';
COMMENT ON COLUMN external_credit_target_codes.last_listed_at IS 'When such a listing last succeeded.';
COMMENT ON COLUMN external_credit_target_codes.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course.';
COMMENT ON COLUMN external_credit_target_codes.consecutive_listing_failures IS 'Failed listing attempts since the last success.';

INSERT INTO external_credit_target_codes (
    created_at,
    deleted_at,
    external_credit_target_id,
    name,
    uh_course_code,
    minimum_tier,
    ects_credits,
    grading,
    enrolment_link,
    config_checked_at,
    checked_course_code,
    course_code_allowed,
    course_code_rejection,
    config_check_message,
    last_listing_attempted_at,
    last_listed_at,
    last_listing_error,
    consecutive_listing_failures
  )
SELECT created_at,
  deleted_at,
  id,
  name,
  uh_course_code,
  LOWER(tiers),
  ects_credits,
  grading,
  enrolment_link,
  config_checked_at,
  checked_course_code,
  course_code_allowed,
  course_code_rejection,
  config_check_message,
  last_listing_attempted_at,
  last_listed_at,
  last_listing_error,
  consecutive_listing_failures
FROM external_credit_targets;

DROP VIEW moocfi_reportable_registrations;
DROP VIEW credit_registration_preconditions;
DROP VIEW credit_registration_registrable_completions;
DROP VIEW credit_registration_eligible_completions;
DROP VIEW credit_registration_active_units;
DROP VIEW credit_registration_subjects;
DROP FUNCTION moocfi_registered_equivalent(external_completions);

ALTER TABLE external_completions
ADD COLUMN external_credit_target_code_id UUID;
UPDATE external_completions ec
SET external_credit_target_code_id = code.id
FROM external_credit_target_codes code
WHERE code.external_credit_target_id = ec.external_credit_target_id;

DROP INDEX uq_external_completions_completion_target;
CREATE UNIQUE INDEX uq_external_completions_completion_code ON external_completions (moocfi_completion_id, external_credit_target_code_id)
WHERE deleted_at IS NULL;

-- A mooc.fi course may now have only one live target, so live targets that split its tiers
-- become codes of its earliest one. A capped tier range turns into a minimum tier, so a higher
-- tier now earns the merged code too.
CREATE TEMPORARY TABLE merged_external_credit_targets ON COMMIT DROP AS
SELECT t.id AS merged_id,
  parent.id AS parent_id
FROM external_credit_targets t
  CROSS JOIN LATERAL (
    SELECT p.id
    FROM external_credit_targets p
    WHERE p.moocfi_course_id = t.moocfi_course_id
      AND p.deleted_at IS NULL
    ORDER BY p.created_at,
      p.id
    LIMIT 1
  ) parent
WHERE t.deleted_at IS NULL
  AND parent.id <> t.id;

UPDATE external_credit_target_codes code
SET external_credit_target_id = m.parent_id
FROM merged_external_credit_targets m
WHERE code.external_credit_target_id = m.merged_id;
UPDATE external_completions ec
SET external_credit_target_id = m.parent_id
FROM merged_external_credit_targets m
WHERE ec.external_credit_target_id = m.merged_id;
UPDATE credit_registrations cr
SET external_credit_target_id = m.parent_id
FROM merged_external_credit_targets m
WHERE cr.external_credit_target_id = m.merged_id;
UPDATE credit_registration_enrolment_check_outcomes o
SET external_credit_target_id = m.parent_id
FROM merged_external_credit_targets m
WHERE o.external_credit_target_id = m.merged_id;
-- Mails to the same person and address under two merged targets would collide on
-- uq_account_linking_email_person_course_address; the parent's or the earliest one stays.
UPDATE credit_registration_account_linking_emails e
SET deleted_at = now()
FROM merged_external_credit_targets m
WHERE e.external_credit_target_id = m.merged_id
  AND e.deleted_at IS NULL
  AND e.replaced_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM credit_registration_account_linking_emails other
      LEFT JOIN merged_external_credit_targets other_m ON other_m.merged_id = other.external_credit_target_id
    WHERE COALESCE(other_m.parent_id, other.external_credit_target_id) = m.parent_id
      AND other.id <> e.id
      AND other.sisu_person_id = e.sisu_person_id
      AND LOWER(other.emailed_to) = LOWER(e.emailed_to)
      AND other.deleted_at IS NULL
      AND other.replaced_at IS NULL
      AND (
        other_m.merged_id IS NULL
        OR (other.created_at, other.id) < (e.created_at, e.id)
      )
  );
UPDATE credit_registration_account_linking_emails e
SET external_credit_target_id = m.parent_id
FROM merged_external_credit_targets m
WHERE e.external_credit_target_id = m.merged_id;
UPDATE external_credit_targets t
SET deleted_at = now()
FROM merged_external_credit_targets m
WHERE t.id = m.merged_id;

DROP TABLE merged_external_credit_targets;

ALTER TABLE external_completions
ALTER COLUMN external_credit_target_code_id
SET NOT NULL,
  ADD CONSTRAINT external_completions_code_of_target FOREIGN KEY (
    external_credit_target_code_id,
    external_credit_target_id
  ) REFERENCES external_credit_target_codes (id, external_credit_target_id);

COMMENT ON TABLE external_completions IS 'A mooc.fi completion as courses last read it, one row per completion and code of its target that its tier earns. The subject of a mooc.fi ledger row, as course_module_completions is of a native one. Facts are copied from mooc.fi when the student opens the registration page and on re-check; mooc.fi stays the source of truth.';
COMMENT ON COLUMN external_completions.external_credit_target_id IS 'The target of external_credit_target_code_id, kept for course-level reads.';
COMMENT ON COLUMN external_completions.external_credit_target_code_id IS 'The code this row registers the completion under. A tier later dropped below the code''s minimum withdraws the row; a raised one adds rows for the codes it newly earns and leaves this one be.';
COMMENT ON COLUMN external_completions.registered_upstream_at IS 'When a registration of the completion under this code by another mooc.fi organization was first seen; one naming no code counts for every code. Withdraws the row: someone else registered it.';
COMMENT ON COLUMN external_completions.reported_at IS 'When a registration of the completion under this code by our organization was first on mooc.fi, reported by us or found there; one naming no code that is not one of our reports counts for every code. Set once. Keeps a completion registered before delegation from getting a ledger row; which registrations were reported is in moocfi_registration_reports.';
COMMENT ON COLUMN external_completions.passed IS 'Whether the parsed grade is a pass, read by the code''s grading. NULL when the grade was not recognised, which keeps the row from registering until it is fixed on mooc.fi.';

DROP INDEX idx_credit_registrations_course_module;
DROP INDEX idx_credit_registrations_module_created;
DROP INDEX idx_credit_registrations_module_error_code;
ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_one_subject,
  DROP COLUMN credit_unit_id,
  ADD COLUMN external_credit_target_code_id UUID;
UPDATE credit_registrations cr
SET external_credit_target_code_id = ec.external_credit_target_code_id
FROM external_completions ec
WHERE ec.id = cr.external_completion_id;
ALTER TABLE credit_registrations
ADD CONSTRAINT credit_registrations_code_of_target FOREIGN KEY (
    external_credit_target_code_id,
    external_credit_target_id
  ) REFERENCES external_credit_target_codes (id, external_credit_target_id),
  ADD COLUMN credit_unit_id UUID GENERATED ALWAYS AS (
    COALESCE(course_module_id, external_credit_target_code_id)
  ) STORED NOT NULL,
  ADD CONSTRAINT credit_registrations_one_subject CHECK (
    (
      course_module_completion_id IS NOT NULL
      AND course_id IS NOT NULL
      AND course_module_id IS NOT NULL
      AND course_instance_id IS NOT NULL
      AND external_completion_id IS NULL
      AND external_credit_target_id IS NULL
      AND external_credit_target_code_id IS NULL
    )
    OR (
      course_module_completion_id IS NULL
      AND course_id IS NULL
      AND course_module_id IS NULL
      AND course_instance_id IS NULL
      AND external_completion_id IS NOT NULL
      AND external_credit_target_id IS NOT NULL
      AND external_credit_target_code_id IS NOT NULL
    )
  );

CREATE INDEX idx_credit_registrations_course_module ON credit_registrations (credit_unit_id, state)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_created ON credit_registrations (credit_unit_id, created_at DESC)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registrations_module_error_code ON credit_registrations (credit_unit_id, error_code)
WHERE error_code IS NOT NULL
  AND deleted_at IS NULL;

COMMENT ON COLUMN credit_registrations.external_credit_target_id IS 'The target that carries the cutoff, enabling and pause of a mooc.fi row, as course_id does the course of a native one. NULL on a course module row.';
COMMENT ON COLUMN credit_registrations.external_credit_target_code_id IS 'The code a mooc.fi row registers under, which carries its configuration as course_module_id does for a native row. NULL on a course module row.';
COMMENT ON COLUMN credit_registrations.credit_unit_id IS 'The module or mooc.fi code the row registers for, whichever kind it is. What every "same unit" comparison and the pause gate use.';

CREATE TABLE credit_registration_sisu_code_checks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  course_code VARCHAR(255) NOT NULL CHECK (course_code = UPPER(TRIM(course_code))),
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attained_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_sisu_code_checks FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE UNIQUE INDEX uq_credit_registration_sisu_code_checks ON credit_registration_sisu_code_checks (user_id, course_code)
WHERE deleted_at IS NULL;

COMMENT ON TABLE credit_registration_sisu_code_checks IS 'Whether Sisu holds an attainment of a course code for a student, asked by resolve-enrolments for codes no ledger row of the student is under: the equivalent older codes of a mooc.fi row''s code, and the prerequisite of its code with that one''s equivalents.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.user_id IS 'The student, asked about by their verified student number at the time.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.course_code IS 'The course code asked about, upper-cased and trimmed.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.checked_at IS 'When Sisu last answered about the code.';
COMMENT ON COLUMN credit_registration_sisu_code_checks.attained_at IS 'When Sisu was first found to hold a passing attainment of the code for the student. Set once: an attainment does not go away.';

DROP TRIGGER external_credit_targets_tier_overlap ON external_credit_targets;
DROP FUNCTION check_external_credit_target_tier_overlap();
DROP INDEX uq_external_credit_targets_course_code;
ALTER TABLE external_credit_targets DROP CONSTRAINT external_credit_targets_check_result,
  DROP COLUMN tiers,
  DROP COLUMN uh_course_code,
  DROP COLUMN ects_credits,
  DROP COLUMN grading,
  DROP COLUMN enrolment_link,
  DROP COLUMN config_checked_at,
  DROP COLUMN checked_course_code,
  DROP COLUMN course_code_allowed,
  DROP COLUMN course_code_rejection,
  DROP COLUMN config_check_message,
  DROP COLUMN last_listing_attempted_at,
  DROP COLUMN last_listed_at,
  DROP COLUMN last_listing_error,
  DROP COLUMN consecutive_listing_failures;

CREATE UNIQUE INDEX uq_external_credit_targets_moocfi_course ON external_credit_targets (moocfi_course_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE external_credit_targets IS 'A mooc.fi course whose credits courses registers into the study registry, standing in for a course and its credit registration switches on mooc.fi ledger rows. At most one live target per mooc.fi course; the course codes it registers under are its external_credit_target_codes.';
COMMENT ON COLUMN external_credit_targets.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting a target withdraws its completions, cancelling their rows not yet submitted.';
COMMENT ON COLUMN external_credit_targets.delegated_at IS 'The cutoff: completions dated at or after it are registered by courses, earlier ones by the mooc.fi pull. Must equal credit_registration_delegated_at of the mooc.fi course; a target with ledger rows must not have it changed.';

CREATE FUNCTION moocfi_registered_equivalent(completion external_completions) RETURNS UUID LANGUAGE sql STABLE AS $$
SELECT earlier.moocfi_completion_id
FROM external_completions earlier
  JOIN external_credit_target_codes earlier_code ON earlier_code.id = earlier.external_credit_target_code_id
  JOIN external_credit_target_codes code ON code.id = completion.external_credit_target_code_id
WHERE earlier.user_id = completion.user_id
  AND earlier.external_credit_target_id = completion.external_credit_target_id
  AND UPPER(TRIM(earlier_code.uh_course_code)) = UPPER(TRIM(code.uh_course_code))
  AND earlier.moocfi_completion_id <> completion.moocfi_completion_id
  AND earlier.completion_date <= completion.completion_date
  AND earlier.deleted_at IS NULL
  AND earlier.upstream_missing_at IS NULL
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
      AND own.external_credit_target_code_id = completion.external_credit_target_code_id
      AND cr.deleted_at IS NULL
      AND cr.state IN ('registered', 'duplicate', 'not_improved')
  )
ORDER BY earlier.completion_date,
  earlier.moocfi_completion_id
LIMIT 1 $$;

COMMENT ON FUNCTION moocfi_registered_equivalent(external_completions) IS 'The mooc.fi id of an equivalent of the completion that is already registered under the same course code, which courses must not register again: an earlier completion of the same mooc.fi course by the same student with the same grade, registered under that code on mooc.fi by any organization or by a success of ours not yet reported. Tiers are not compared: a code is the same credit whichever tier earned it. Grades compare by moocfi_comparable_grade. One dated the same moment counts as earlier. NULL when there is none, or when the completion is registered under the code itself.';

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
  ) AS course_name,
  NULL::uuid AS external_credit_target_code_id
FROM course_module_completions cmc
UNION ALL
SELECT ec.id AS subject_id,
  'mooc_fi'::text AS kind,
  ec.user_id,
  ec.external_credit_target_code_id AS credit_unit_id,
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
      )
  )
  OR EXISTS (
    SELECT 1
    FROM external_credit_target_codes code
    WHERE code.id = ec.external_credit_target_code_id
      AND (
        code.deleted_at IS NOT NULL
        OR (
          code.minimum_tier IS NOT NULL
          AND (ec.tier >= code.minimum_tier) IS NOT TRUE
        )
      )
  ) AS is_withdrawn,
  TRUE AS is_on_pipeline,
  moocfi_registered_equivalent(ec) AS registered_equivalent_moocfi_completion_id,
  ec.created_at,
  ec.updated_at,
  ec.revised_at,
  (
    SELECT code.uh_course_code
    FROM external_credit_target_codes code
    WHERE code.id = ec.external_credit_target_code_id
  ) AS uh_course_code,
  (
    SELECT code.ects_credits
    FROM external_credit_target_codes code
    WHERE code.id = ec.external_credit_target_code_id
  ) AS ects_credits,
  (
    SELECT NULLIF(TRIM(code.enrolment_link), '')
    FROM external_credit_target_codes code
    WHERE code.id = ec.external_credit_target_code_id
  ) AS enrolment_link,
  (
    SELECT t.language_code
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS language_code,
  (
    SELECT code.name
    FROM external_credit_target_codes code
    WHERE code.id = ec.external_credit_target_code_id
  ) AS unit_name,
  (
    SELECT t.name
    FROM external_credit_targets t
    WHERE t.id = ec.external_credit_target_id
  ) AS course_name,
  ec.external_credit_target_code_id
FROM external_completions ec;

COMMENT ON VIEW credit_registration_subjects IS 'Every completion a ledger row can register, course module completions and mooc.fi completions alike, with the facts of the completion and of the unit (module or mooc.fi code) it registers for. Ledger rows join it on subject_id.';
COMMENT ON COLUMN credit_registration_subjects.kind IS '''course_module'' or ''mooc_fi''.';
COMMENT ON COLUMN credit_registration_subjects.passed IS 'NULL for a mooc.fi completion whose grade was not recognised.';
COMMENT ON COLUMN credit_registration_subjects.fully_eligible IS 'Passed and ECTS-eligible, and for a course module completion also not waiting on a prerequisite module or a suspected-cheating review.';
COMMENT ON COLUMN credit_registration_subjects.is_withdrawn IS 'The completion is no longer ours to register: deleted, or for mooc.fi also gone upstream, registered under the code by another organization or through a registered equivalent, dated before the cutoff, on a deleted target or code, or with a tier below the code''s minimum. Withdrawal cancels rows not yet submitted.';
COMMENT ON COLUMN credit_registration_subjects.is_on_pipeline IS 'Registered by this pipeline rather than the pull path. Always true for mooc.fi completions: the pull already excludes everything at or after the cutoff.';
COMMENT ON COLUMN credit_registration_subjects.registered_equivalent_moocfi_completion_id IS 'See moocfi_registered_equivalent. Always NULL for a course module completion.';
COMMENT ON COLUMN credit_registration_subjects.revised_at IS 'When the completion last changed in a way that could matter to its registration. For a course module completion its updated_at.';
COMMENT ON COLUMN credit_registration_subjects.unit_name IS 'The module''s name, or the mooc.fi code''s.';
COMMENT ON COLUMN credit_registration_subjects.course_name IS 'The course''s name, or the mooc.fi target''s.';
COMMENT ON COLUMN credit_registration_subjects.external_credit_target_code_id IS 'The mooc.fi code, the same as credit_unit_id. NULL for a course module completion.';

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
SELECT code.id AS credit_unit_id,
  NULL::uuid AS course_id,
  t.id AS external_credit_target_id,
  code.uh_course_code
FROM external_credit_target_codes code
  JOIN external_credit_targets t ON t.id = code.external_credit_target_id
WHERE t.enabled_at IS NOT NULL
  AND t.paused_at IS NULL
  AND t.deleted_at IS NULL
  AND code.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_active_units IS 'Modules with a course code and credit_registration_route platform, and the live codes of enabled mooc.fi targets, that are not paused. The gate every phase that spends work on a unit shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

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
  s.external_credit_target_id,
  s.external_credit_target_code_id
FROM credit_registration_subjects s
  LEFT JOIN course_modules cm ON cm.id = s.course_module_id
WHERE s.is_on_pipeline
  AND NOT s.is_withdrawn
  AND s.passed IS TRUE
  AND s.eligible_for_ects
  AND TRIM(s.uh_course_code) <> ''
  AND cm.deleted_at IS NULL
  AND (cm.credit_registration_route = 'platform') IS NOT FALSE;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live unit with a course code (and, for a module, credit_registration_route platform), and on the pipeline. For a course module completion that is the push-path mark set at creation; the pull path excludes exactly the rows carrying it. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
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

COMMENT ON VIEW credit_registration_registrable_completions IS 'Eligible completions that have no ledger row and are not already in the study registry through the pull path or reported to mooc.fi as registered under their code. Exactly the rows the materialiser creates a registration for, and so exactly the rows it may be accused of having missed. fully_eligible is not applied here: a completion still waiting on a prerequisite gets its row and waits in pending.';

CREATE FUNCTION credit_registration_prerequisite_met(registration credit_registrations) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
SELECT NOT EXISTS (
    SELECT 1
    FROM external_credit_target_codes code
      JOIN external_credit_target_codes prerequisite ON prerequisite.id = code.prerequisite_code_id
    WHERE code.id = registration.external_credit_target_code_id
      AND NOT EXISTS (
        SELECT 1
        FROM credit_registration_sisu_code_checks held
        WHERE held.user_id = registration.user_id
          AND held.deleted_at IS NULL
          AND held.attained_at IS NOT NULL
          AND held.course_code IN (
            SELECT UPPER(TRIM(equivalent))
            FROM UNNEST(
                prerequisite.uh_course_code::text || prerequisite.equivalent_course_codes
              ) AS equivalent
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM credit_registrations done
        WHERE done.user_id = registration.user_id
          AND done.deleted_at IS NULL
          AND done.state IN (
            'registered',
            'duplicate',
            'not_improved',
            'partially_registered'
          )
          AND (
            done.external_credit_target_code_id = prerequisite.id
            OR UPPER(TRIM(done.uh_course_code)) IN (
              SELECT UPPER(TRIM(equivalent))
              FROM UNNEST(
                  prerequisite.uh_course_code::text || prerequisite.equivalent_course_codes
                ) AS equivalent
            )
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM external_completions prior
        WHERE prior.user_id = registration.user_id
          AND prior.external_credit_target_code_id = prerequisite.id
          AND prior.deleted_at IS NULL
          AND prior.upstream_missing_at IS NULL
          AND prior.reported_at IS NOT NULL
      )
  ) $$;

COMMENT ON FUNCTION credit_registration_prerequisite_met(credit_registrations) IS 'Whether the row may go to Sisu as far as its code''s prerequisite goes: true when the code has none, or the student already has it, through a ledger row of theirs under the prerequisite or one of its equivalent codes that is registered, duplicate, not_improved or partially_registered, a registration of ours under it on mooc.fi, or Sisu holding it or an equivalent (credit_registration_sisu_code_checks). Always true for a course module row. Import claims no row for which it is false.';

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
    FROM external_credit_target_codes code
    WHERE code.id = cr.external_credit_target_code_id
      AND NOT code.course_code_allowed
      AND code.checked_course_code = TRIM(code.uh_course_code)
  ) AS course_code_allowed,
  s.passed IS NULL AS grade_unrecognised,
  s.subject_id,
  credit_registration_prerequisite_met(cr) AS prerequisite_met
FROM credit_registrations cr
  JOIN credit_registration_subjects s ON s.subject_id = cr.subject_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_preconditions IS 'The things one ledger row waits on, as they stand right now. The ledger records only that a row is pending, so this is where every surface that names the blocker, and the precondition recompute that acts on it, read the same answer.';
COMMENT ON COLUMN credit_registration_preconditions.is_withdrawn IS 'See credit_registration_subjects.is_withdrawn.';
COMMENT ON COLUMN credit_registration_preconditions.frozen_identity_stale IS 'The account has relinked to a different verified student number since this row froze its payload for import. A relink soft-deletes and re-inserts in one transaction, so has_verified_student_number stays true throughout and catches none of it.';
COMMENT ON COLUMN credit_registration_preconditions.course_code_allowed IS 'False while Suotar''s last verdict on the unit''s current course code says it does not accept it; true once it does, or when there is no verdict. Rows wait in pending while false, since every import would come back courseNotAllowed.';
COMMENT ON COLUMN credit_registration_preconditions.grade_unrecognised IS 'The mooc.fi grade could not be parsed, so completion_eligible is false until it is fixed on mooc.fi. Always false for a course module completion.';
COMMENT ON COLUMN credit_registration_preconditions.prerequisite_met IS 'See credit_registration_prerequisite_met. A row for which it is false waits in checking_enrolment.';

CREATE VIEW moocfi_reportable_registrations AS
SELECT cr.id AS credit_registration_id,
  cr.external_completion_id,
  ec.moocfi_completion_id,
  COALESCE(cr.registered_at, cr.terminal_at, cr.state_entered_at) AS registration_date,
  cr.uh_course_code
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
          AND earlier_ec.external_credit_target_code_id = ec.external_credit_target_code_id
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

COMMENT ON VIEW moocfi_reportable_registrations IS 'The mooc.fi ledger rows that report-back tells mooc.fi about, one report each, since mooc.fi keeps every registration of a completion as history. Every registered row, a later grade improvement included. A duplicate or not_improved row puts nothing new in Sisu, so it is reported only when it is the first success of its mooc.fi completion under its code: mooc.fi must still learn that the completion is registered under it. An earlier success deleted since still counts if it was reported.';
COMMENT ON COLUMN moocfi_reportable_registrations.registration_date IS 'When the credit landed in the study registry. What moocfi_registration_reports.registration_date is fixed from.';
COMMENT ON COLUMN moocfi_reportable_registrations.uh_course_code IS 'The course code the row was sent under, which mooc.fi records with the registration.';
