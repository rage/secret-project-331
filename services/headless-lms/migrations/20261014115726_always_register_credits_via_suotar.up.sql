CREATE OR REPLACE VIEW credit_registration_active_course_modules AS
SELECT cm.id AS course_module_id,
  cm.course_id
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE TRIM(cm.uh_course_code) <> ''
  AND cm.deleted_at IS NULL
  AND conf.paused_at IS NULL;

COMMENT ON VIEW credit_registration_active_course_modules IS 'Modules with a course code whose credit registration is not paused. The gate every phase that spends work on a module shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

ALTER TABLE course_modules DROP COLUMN enable_credit_registration_via_suotar,
  DROP COLUMN register_eligible_new_completions_via_suotar,
  DROP COLUMN enable_registering_completion_to_uh_open_university;

ALTER TABLE course_module_completions
ALTER COLUMN register_credits_via_suotar
SET DEFAULT TRUE;

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
WHERE cmc.register_credits_via_suotar
  AND cm.deleted_at IS NULL
  AND TRIM(cm.uh_course_code) <> ''
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Every completion created now gets it; a row with this false predates the push path and is registered the old way end to end. A completion of a module without a course code is registered by neither path. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. Changing it by hand is safe only while no other registrar holds or may still send the completion.';
COMMENT ON TABLE course_module_suotar_configurations IS 'Per-module Suotar credit registration configuration, the per-module pause, and the config-validation phase''s last verdict. At most one live row per course module; no row means the module is not configured, which is not an error.';
COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module with a course code, and marked for the push path when they were created. The pull path excludes exactly the rows carrying the mark. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
