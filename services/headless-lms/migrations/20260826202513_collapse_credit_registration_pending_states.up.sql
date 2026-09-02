-- Three collapsed states share one snapshot row per day, and the unique index would reject the
-- second of them. Summed rather than picked: the three depths were disjoint queues of the same day.
WITH totals AS (
  SELECT snapshot_date,
    deleted_at,
    -- The prerequisites row where the day has one, so the survivor needs no state rewrite and
    -- cannot collide with a row this same statement is keeping.
    (
      ARRAY_AGG(
        id
        ORDER BY (state = 'pending_prerequisites') DESC,
          id
      )
    ) [1] AS survivor_id,
    SUM(count)::int AS count,
    SUM(entered_count)::int AS entered_count,
    SUM(left_count)::int AS left_count
  FROM credit_registration_daily_snapshots
  WHERE state IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    )
  GROUP BY snapshot_date,
    deleted_at
)
UPDATE credit_registration_daily_snapshots s
SET state = 'pending_prerequisites',
  count = totals.count,
  entered_count = totals.entered_count,
  left_count = totals.left_count
FROM totals
WHERE s.id = totals.survivor_id;

DELETE FROM credit_registration_daily_snapshots
WHERE state IN ('pending_consent', 'pending_student_number');

-- Consent is gone from the model, so a row abandoned by a withdrawal is simply cancelled. Same
-- snapshot collision as above: the day can already hold a cancelled row.
WITH totals AS (
  SELECT snapshot_date,
    deleted_at,
    (
      ARRAY_AGG(
        id
        ORDER BY (state = 'cancelled') DESC,
          id
      )
    ) [1] AS survivor_id,
    SUM(count)::int AS count,
    SUM(entered_count)::int AS entered_count,
    SUM(left_count)::int AS left_count
  FROM credit_registration_daily_snapshots
  WHERE state IN ('cancelled', 'abandoned_by_consent_withdrawal')
  GROUP BY snapshot_date,
    deleted_at
)
UPDATE credit_registration_daily_snapshots s
SET state = 'cancelled',
  count = totals.count,
  entered_count = totals.entered_count,
  left_count = totals.left_count
FROM totals
WHERE s.id = totals.survivor_id;

DELETE FROM credit_registration_daily_snapshots
WHERE state = 'abandoned_by_consent_withdrawal';

-- Their predicates name enum literals, which an ALTER of the column type cannot rewrite.
DROP INDEX uq_credit_registrations_person_module;

DROP INDEX idx_credit_registrations_unnotified;

ALTER TABLE credit_registrations
ALTER COLUMN state DROP DEFAULT;

ALTER TYPE credit_registration_state
RENAME TO credit_registration_state_old;

CREATE TYPE credit_registration_state AS ENUM (
  'pending',
  'ready_to_submit',
  'resolving_enrolment',
  'checking_enrolment',
  'no_usable_enrolment',
  'submitting',
  'submission_uncertain',
  'awaiting_verification',
  'registered',
  'duplicate',
  'not_improved',
  'misregistered',
  'failed_retryable',
  'failed_permanent',
  'blocked',
  'cancelled'
);

ALTER TABLE credit_registrations
ALTER COLUMN state TYPE credit_registration_state USING CASE
    WHEN state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_events
ALTER COLUMN from_state TYPE credit_registration_state USING CASE
    WHEN from_state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN from_state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE from_state::text
  END::credit_registration_state,
  ALTER COLUMN to_state TYPE credit_registration_state USING CASE
    WHEN to_state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN to_state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE to_state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_admin_actions
ALTER COLUMN before_state TYPE credit_registration_state USING CASE
    WHEN before_state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN before_state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE before_state::text
  END::credit_registration_state,
  ALTER COLUMN after_state TYPE credit_registration_state USING CASE
    WHEN after_state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN after_state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE after_state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_daily_snapshots
ALTER COLUMN state TYPE credit_registration_state USING CASE
    WHEN state::text IN (
      'pending_prerequisites',
      'pending_consent',
      'pending_student_number'
    ) THEN 'pending'
    WHEN state::text = 'abandoned_by_consent_withdrawal' THEN 'cancelled'
    ELSE state::text
  END::credit_registration_state;

DROP TYPE credit_registration_state_old;

ALTER TABLE credit_registrations
ALTER COLUMN state
SET DEFAULT 'pending';

COMMENT ON TYPE credit_registration_state IS 'Lifecycle state of one credit registration. pending covers every precondition a submission waits on; which one a row is actually waiting for is derived at read time from the completion and the verified student number, so the ledger holds no cache of it. The success set for reporting and for the double-registration guard is exactly {registered, duplicate, not_improved}.';

CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'registered',
    'duplicate',
    'not_improved'
  );

CREATE INDEX idx_credit_registrations_unnotified ON credit_registrations (state_entered_at)
WHERE deleted_at IS NULL
  AND (
    (
      state = 'no_usable_enrolment'::credit_registration_state
      AND action_needed_email_delivery_id IS NULL
    )
    OR (
      state IN (
        'registered'::credit_registration_state,
        'duplicate'::credit_registration_state,
        'not_improved'::credit_registration_state
      )
      AND registered_email_delivery_id IS NULL
    )
  );

UPDATE credit_registrations cr
SET superseded_by_id = successor.id
FROM credit_registrations successor
WHERE cr.superseded_by_id = cr.id
  AND successor.course_module_completion_id = cr.course_module_completion_id
  AND successor.attempt_number = cr.attempt_number + 1
  AND successor.deleted_at IS NULL;

-- What is left was parked for a successor that was never inserted, so it was never superseded at
-- all: keeping the timestamp would hide a live attempt from every live-attempt query forever.
UPDATE credit_registrations
SET superseded_by_id = NULL,
  superseded_at = NULL
WHERE superseded_by_id = id;

-- Deferred so the materialiser can point an attempt at its successor before inserting it, inside
-- one transaction, instead of parking the row on itself to clear uq_credit_registrations_completion.
ALTER TABLE credit_registrations
DROP CONSTRAINT credit_registrations_superseded_by_id_fkey;

ALTER TABLE credit_registrations
ADD CONSTRAINT credit_registrations_superseded_by_id_fkey FOREIGN KEY (superseded_by_id) REFERENCES credit_registrations(id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE credit_registrations
ADD CONSTRAINT credit_registrations_superseded_pair CHECK (
    (superseded_by_id IS NULL) = (superseded_at IS NULL)
  ),
  -- A row pointing at itself reads everywhere as "replaced" with no successor to send anyone to.
  ADD CONSTRAINT credit_registrations_superseded_by_not_self CHECK (superseded_by_id <> id),
  ADD CONSTRAINT credit_registrations_registered_at_set CHECK (
    state <> 'registered'
    OR registered_at IS NOT NULL
  ),
  ADD CONSTRAINT credit_registrations_attempt_counts_nonnegative CHECK (
    submit_retry_count >= 0
    AND verify_attempt_count >= 0
    AND attempt_number >= 1
  );

-- The failure side already has one; the success side is read by get_endpoint_standings and the
-- window counts every half minute.
CREATE INDEX idx_suotar_api_calls_endpoint_successes ON suotar_api_calls (endpoint, started_at DESC)
WHERE succeeded;

-- Serves count_by_module's per-module top_error_code subquery.
CREATE INDEX idx_credit_registrations_module_error_code ON credit_registrations (course_module_id, error_code)
WHERE error_code IS NOT NULL
  AND deleted_at IS NULL;

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
WHERE cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects;

COMMENT ON VIEW credit_registration_eligible_completions IS 'Completions the push path is responsible for: live, passed, ECTS-eligible, on a live module opted in to credit registration. Membership is the hard half of the predicate, which nothing recovers from by waiting; fully_eligible is the soft half, which a prerequisite completed or a suspected-cheating review dismissed can turn true later. Deliberately silent about whether a completion is paused or already has a ledger row: pausing freezes rows where they stand rather than making them ineligible, and having a row is credit_registration_registrable_completions.';

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
  ) AS frozen_identity_stale
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;

COMMENT ON VIEW credit_registration_preconditions IS 'The things one ledger row waits on, as they stand right now. The ledger records only that a row is pending, so this is where every surface that names the blocker, and the precondition recompute that acts on it, read the same answer.';

COMMENT ON COLUMN credit_registration_preconditions.frozen_identity_stale IS 'The account has relinked to a different verified student number since this row froze its payload for import. A relink soft-deletes and re-inserts in one transaction, so has_verified_student_number stays true throughout and catches none of it.';

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

DROP TABLE course_credit_registration_consents;
