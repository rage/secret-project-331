ALTER TABLE course_modules
ADD COLUMN automatic_completion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN automatic_completion_requires_exam BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN completions_can_be_registered_to_sisu BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE course_modules DROP CONSTRAINT course_module_completion_requirements_validity,
  DROP CONSTRAINT course_module_completion_method_fits_exam,
  DROP CONSTRAINT course_module_exam_location_described;

-- A by_exam module without thresholds cannot be represented in the old schema.
UPDATE course_modules
SET automatic_completion_number_of_points_treshold = 0
WHERE completion_method = 'by_exam'
  AND automatic_completion_number_of_exercises_attempted_treshold IS NULL
  AND automatic_completion_number_of_points_treshold IS NULL;

UPDATE course_modules
SET automatic_completion = completion_method IN ('by_requirements', 'by_exam'),
  automatic_completion_requires_exam = completion_method = 'by_exam',
  completions_can_be_registered_to_sisu = credit_registration_route = 'platform';

ALTER TABLE course_modules
ADD CONSTRAINT course_module_automatic_completion_validity CHECK (
    automatic_completion <> (
      COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold
      ) IS NULL
    )
  );

COMMENT ON COLUMN course_modules.automatic_completion IS 'Whether or not automatic completion is enabled for this module.';
COMMENT ON COLUMN course_modules.automatic_completion_requires_exam IS 'If automatic completion is enabled, whether an exam is also required or not.';
COMMENT ON COLUMN course_modules.completions_can_be_registered_to_sisu IS 'When false, the module''s completions are registered by neither the push nor the pull path, and students are not offered credit registration for them, course code or not.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_exercises_attempted_treshold IS 'If automatic completions are enabled, the amount of exercises that need to be attempted (submitted at least once) to be qualified for completion.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_points_treshold IS 'If automatic completions are enabled, the amount of points that need to be gained to be qualified for completion.';

CREATE OR REPLACE VIEW credit_registration_active_units AS
SELECT cm.id AS credit_unit_id,
  cm.course_id,
  NULL::uuid AS external_credit_target_id,
  cm.uh_course_code
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE TRIM(cm.uh_course_code) <> ''
  AND cm.completions_can_be_registered_to_sisu
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

COMMENT ON VIEW credit_registration_active_units IS 'Modules with a course code and completions_can_be_registered_to_sisu on, and enabled mooc.fi targets, that are not paused. The gate every phase that spends work on a unit shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

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
  AND cm.completions_can_be_registered_to_sisu IS NOT FALSE;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live unit with a course code (and, for a module, completions_can_be_registered_to_sisu on), and on the pipeline. For a course module completion that is the push-path mark set at creation; the pull path excludes exactly the rows carrying it. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';

ALTER TABLE course_modules DROP COLUMN exam_requirement,
  DROP COLUMN exam_location_description,
  DROP COLUMN completion_method,
  DROP COLUMN credit_registration_route;
DROP TYPE course_module_exam_requirement;
DROP TYPE course_module_completion_method;
DROP TYPE course_module_credit_registration_route;

CREATE FUNCTION pg_temp.revert_module_snapshot(snapshot JSONB) RETURNS JSONB LANGUAGE SQL IMMUTABLE AS $$
SELECT (
    snapshot - 'completion_policy' - 'exam_requirement' - 'exam_location_description' - 'credit_registration_route'
  ) || jsonb_build_object(
    'completion_policy',
    CASE
      WHEN snapshot->'completion_policy'->>'method' IN ('by_requirements', 'by_exam') THEN ((snapshot->'completion_policy') - 'method') || jsonb_build_object(
        'policy',
        'automatic',
        'requires_exam',
        snapshot->'completion_policy'->>'method' = 'by_exam'
      )
      ELSE jsonb_build_object('policy', 'manual')
    END,
    'completions_can_be_registered_to_sisu',
    snapshot->>'credit_registration_route' = 'platform'
  ) $$;

UPDATE entity_history
SET snapshot = pg_temp.revert_module_snapshot(snapshot)
WHERE entity_type = 'module'
  AND snapshot ? 'credit_registration_route';
UPDATE agent_changeset_entities
SET base_snapshot = pg_temp.revert_module_snapshot(base_snapshot)
WHERE entity_type = 'module'
  AND base_snapshot ? 'credit_registration_route';
UPDATE agent_changeset_entities
SET after_snapshot = pg_temp.revert_module_snapshot(after_snapshot)
WHERE entity_type = 'module'
  AND after_snapshot ? 'credit_registration_route';
UPDATE agent_changeset_call_entities
SET before_snapshot = pg_temp.revert_module_snapshot(before_snapshot)
WHERE entity_type = 'module'
  AND before_snapshot ? 'credit_registration_route';
