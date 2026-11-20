ALTER TABLE course_module_completions
ALTER COLUMN register_credits_via_suotar
SET DEFAULT FALSE;

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
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

ALTER TABLE course_modules
ADD COLUMN enable_registering_completion_to_uh_open_university BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN enable_credit_registration_via_suotar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN register_eligible_new_completions_via_suotar BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE VIEW credit_registration_active_course_modules AS
SELECT cm.id AS course_module_id,
  cm.course_id
FROM course_modules cm
  LEFT JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND conf.paused_at IS NULL;

COMMENT ON VIEW credit_registration_active_course_modules IS 'Modules whose credit registration is switched on and not paused. The gate every phase that spends work on a module shares; both ways out of it freeze what is in flight rather than cancelling it, so a query filtering on membership must leave the rows it stops seeing alone.';

CREATE INDEX idx_course_modules_suotar_enabled ON course_modules (course_id, order_number)
WHERE enable_credit_registration_via_suotar
  AND deleted_at IS NULL;

COMMENT ON COLUMN course_modules.enable_credit_registration_via_suotar IS 'Whether the module takes part in credit registration via Suotar: the pipeline runs for it and its configuration is checked. It does not move completions onto that path by itself; only completions with register_credits_via_suotar set go there, and the rest stay with enable_registering_completion_to_uh_open_university, which may be on at the same time.';
COMMENT ON COLUMN course_modules.register_eligible_new_completions_via_suotar IS 'While on, and while the module is live with enable_credit_registration_via_suotar on, a completion created for this module gets register_credits_via_suotar set, whether or not its student has linked a student number yet; an unlinked one waits for the link. Checked once at creation: completions made before it was turned on are not swept in, and turning it off affects only completions created afterwards. Set by hand only.';
COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Set at creation when the module is live and has both enable_credit_registration_via_suotar and register_eligible_new_completions_via_suotar on; otherwise changed by hand only. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. A row with this false is registered the old way end to end. Changing it by hand is safe only while no other registrar holds or may still send the completion.';
COMMENT ON TABLE course_module_suotar_configurations IS 'Per-module Suotar credit registration configuration, the per-module pause, and the config-validation phase''s last verdict. At most one live row per course module; no row means the module is not configured, which is not an error. The enable_credit_registration_via_suotar rollout switch stays on course_modules instead, because it is read on the per-user my-studies path for every logged-in user.';
COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module, and marked for the push path when they were created. Marked, not on a module opted in now: the flag is frozen at creation and the pull path excludes exactly the rows carrying it, so demanding the module''s flag as well would strand a completion between the two paths. Turning the module off instead pauses these rows, in claim_due. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';
