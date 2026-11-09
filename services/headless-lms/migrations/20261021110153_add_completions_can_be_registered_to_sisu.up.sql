ALTER TABLE course_modules
ADD COLUMN completions_can_be_registered_to_sisu BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN course_modules.completions_can_be_registered_to_sisu IS 'When false, the module''s completions are registered by neither the push nor the pull path, and students are not offered credit registration for them, course code or not.';

CREATE OR REPLACE VIEW credit_registration_active_course_modules AS
SELECT cm.id AS course_module_id,
  cm.course_id
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE TRIM(cm.uh_course_code) <> ''
  AND cm.completions_can_be_registered_to_sisu
  AND cm.deleted_at IS NULL
  AND conf.paused_at IS NULL;

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
  AND cm.completions_can_be_registered_to_sisu
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON VIEW credit_registration_active_course_modules IS 'Modules with a course code, completions_can_be_registered_to_sisu on, and credit registration not paused. The gate every phase that spends work on a module shares; every way out of it freezes what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';
COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module with a course code and completions_can_be_registered_to_sisu on, and marked for the push path when they were created. The pull path excludes exactly the rows carrying the mark. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
