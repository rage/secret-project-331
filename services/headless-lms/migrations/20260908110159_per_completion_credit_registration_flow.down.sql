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
  AND cm.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module opted in to credit registration. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';

DROP TABLE credit_registration_enrolment_routes;

DROP TYPE credit_registration_enrolment_route;

ALTER TABLE course_module_completions DROP COLUMN register_credits_via_suotar;
