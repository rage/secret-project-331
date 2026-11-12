CREATE TYPE course_module_exam_requirement AS ENUM (
  'none',
  'platform',
  'examinarium',
  'elsewhere'
);
CREATE TYPE course_module_completion_method AS ENUM (
  'not_decided',
  'by_requirements',
  'by_exam',
  'teacher_adds'
);
CREATE TYPE course_module_credit_registration_route AS ENUM ('platform', 'external', 'certificate_only');

ALTER TABLE course_modules
ADD COLUMN exam_requirement course_module_exam_requirement NOT NULL DEFAULT 'none',
  ADD COLUMN exam_location_description TEXT,
  ADD COLUMN completion_method course_module_completion_method NOT NULL DEFAULT 'not_decided',
  ADD COLUMN credit_registration_route course_module_credit_registration_route NOT NULL DEFAULT 'platform';

UPDATE course_modules
SET completion_method = CASE
    WHEN NOT automatic_completion THEN 'teacher_adds'
    WHEN automatic_completion_requires_exam THEN 'by_exam'
    ELSE 'by_requirements'
  END::course_module_completion_method,
  exam_requirement = CASE
    WHEN automatic_completion
    AND automatic_completion_requires_exam THEN 'platform'
    ELSE 'none'
  END::course_module_exam_requirement,
  credit_registration_route = CASE
    WHEN completions_can_be_registered_to_sisu THEN 'platform'
    ELSE 'certificate_only'
  END::course_module_credit_registration_route;

ALTER TABLE course_modules DROP CONSTRAINT course_module_automatic_completion_validity,
  ADD CONSTRAINT course_module_completion_requirements_validity CHECK (
    CASE
      completion_method
      WHEN 'by_requirements' THEN COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold
      ) IS NOT NULL
      WHEN 'by_exam' THEN TRUE
      ELSE automatic_completion_number_of_exercises_attempted_treshold IS NULL
      AND automatic_completion_number_of_points_treshold IS NULL
    END
  ),
  ADD CONSTRAINT course_module_completion_method_fits_exam CHECK (
    CASE
      completion_method
      WHEN 'by_requirements' THEN exam_requirement = 'none'
      WHEN 'by_exam' THEN exam_requirement = 'platform'
      ELSE TRUE
    END
  ),
  ADD CONSTRAINT course_module_exam_location_described CHECK (
    exam_requirement <> 'elsewhere'
    OR TRIM(exam_location_description) <> ''
  );

COMMENT ON COLUMN course_modules.exam_requirement IS 'Whether passing the module requires an exam and where it is held: on this platform (an exam linked to the course), in Examinarium, or elsewhere. The platform knows nothing about Examinarium or other outside exams.';
COMMENT ON COLUMN course_modules.exam_location_description IS 'Where the exam is held, as the teacher describes it, when exam_requirement is elsewhere.';
COMMENT ON COLUMN course_modules.completion_method IS 'How students get a completion. by_requirements completes them automatically once they reach the thresholds; by_exam once they reach the pass mark of an ended exam linked to the course, the thresholds then being the condition for taking the exam; teacher_adds and not_decided never complete anyone automatically.';
COMMENT ON COLUMN course_modules.credit_registration_route IS 'How completions turn into credits: platform registers them in Sisu; external means the teacher registers the credits outside this platform (e.g. straight from Examinarium); certificate_only registers nothing. Only platform completions are ever registered by this platform, course code or not.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_exercises_attempted_treshold IS 'The number of exercises that need to be attempted (submitted at least once): for by_requirements to get a completion, for by_exam to take the exam. NULL for the other completion methods.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_points_treshold IS 'The number of points that need to be gained: for by_requirements to get a completion, for by_exam to take the exam. NULL for the other completion methods.';

CREATE OR REPLACE VIEW credit_registration_active_units AS
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

CREATE OR REPLACE VIEW credit_registration_eligible_completions AS
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

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live unit with a course code (and, for a module, credit_registration_route platform), and on the pipeline. For a course module completion that is the push-path mark set at creation; the pull path excludes exactly the rows carrying it. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';

ALTER TABLE course_modules DROP COLUMN automatic_completion,
  DROP COLUMN automatic_completion_requires_exam,
  DROP COLUMN completions_can_be_registered_to_sisu;

-- Stored module snapshots are parsed into the current snapshot shape, so they move with the columns.
CREATE FUNCTION pg_temp.convert_module_snapshot(snapshot JSONB) RETURNS JSONB LANGUAGE SQL IMMUTABLE AS $$
SELECT (
    snapshot - 'completions_can_be_registered_to_sisu' - 'completion_policy'
  ) || jsonb_build_object(
    'completion_policy',
    CASE
      WHEN snapshot->'completion_policy'->>'policy' = 'automatic' THEN (
        (snapshot->'completion_policy') - 'policy' - 'requires_exam'
      ) || jsonb_build_object(
        'method',
        CASE
          WHEN (snapshot->'completion_policy'->>'requires_exam')::BOOLEAN THEN 'by_exam'
          ELSE 'by_requirements'
        END
      )
      ELSE jsonb_build_object('method', 'teacher_adds')
    END,
    'exam_requirement',
    CASE
      WHEN snapshot->'completion_policy'->>'policy' = 'automatic'
      AND (snapshot->'completion_policy'->>'requires_exam')::BOOLEAN THEN 'platform'
      ELSE 'none'
    END,
    'exam_location_description',
    NULL,
    'credit_registration_route',
    CASE
      WHEN (snapshot->>'completions_can_be_registered_to_sisu')::BOOLEAN IS FALSE THEN 'certificate_only'
      ELSE 'platform'
    END
  ) $$;

UPDATE entity_history
SET snapshot = pg_temp.convert_module_snapshot(snapshot)
WHERE entity_type = 'module'
  AND snapshot ? 'completions_can_be_registered_to_sisu';
UPDATE agent_changeset_entities
SET base_snapshot = pg_temp.convert_module_snapshot(base_snapshot)
WHERE entity_type = 'module'
  AND base_snapshot ? 'completions_can_be_registered_to_sisu';
UPDATE agent_changeset_entities
SET after_snapshot = pg_temp.convert_module_snapshot(after_snapshot)
WHERE entity_type = 'module'
  AND after_snapshot ? 'completions_can_be_registered_to_sisu';
UPDATE agent_changeset_call_entities
SET before_snapshot = pg_temp.convert_module_snapshot(before_snapshot)
WHERE entity_type = 'module'
  AND before_snapshot ? 'completions_can_be_registered_to_sisu';
