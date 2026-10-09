ALTER TABLE credit_registrations
ADD COLUMN state_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN phase_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

CREATE FUNCTION pg_temp.timeline_phase(state credit_registration_state) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
SELECT CASE
    WHEN state = 'pending' THEN 'pending'
    WHEN state IN (
      'ready_to_submit',
      'resolving_enrolment',
      'checking_enrolment',
      'no_usable_enrolment',
      'submitting',
      'submission_uncertain',
      'failed_retryable',
      'failed_permanent'
    ) THEN 'registering'
    WHEN state IN (
      'awaiting_verification',
      'partially_registered',
      'registered',
      'misregistered'
    ) THEN 'confirmation'
    ELSE 'ended'
  END $$;

UPDATE credit_registrations cr
SET state_changed_at = COALESCE(
    (
      SELECT MAX(e.created_at)
      FROM credit_registration_events e
      WHERE e.credit_registration_id = cr.id
        AND e.to_state = cr.state
        AND e.from_state IS DISTINCT FROM e.to_state
    ),
    cr.created_at
  );

UPDATE credit_registrations cr
SET phase_started_at = COALESCE(
    (
      SELECT MIN(e.created_at)
      FROM credit_registration_events e
      WHERE e.credit_registration_id = cr.id
        AND e.to_state IS NOT NULL
        AND pg_temp.timeline_phase(e.to_state) = pg_temp.timeline_phase(cr.state)
        AND e.created_at > COALESCE(
          (
            SELECT MAX(other.created_at)
            FROM credit_registration_events other
            WHERE other.credit_registration_id = cr.id
              AND other.to_state IS NOT NULL
              AND pg_temp.timeline_phase(other.to_state) <> pg_temp.timeline_phase(cr.state)
          ),
          '-infinity'
        )
    ),
    cr.state_changed_at
  );

COMMENT ON COLUMN credit_registrations.state_changed_at IS 'When the row last entered a different state. Unlike state_entered_at, a write that leaves the row in its state (every verify poll and enrolment check does) does not move it, so it measures how long the row has really been where it is.';
COMMENT ON COLUMN credit_registrations.phase_started_at IS 'When the row last moved into a different timeline phase by a state change. All of pending counts as one phase here: the ledger does not record which precondition a pending row waits on.';

CREATE TYPE credit_registration_attention_reason AS ENUM (
  'stuck_in_state',
  'permanent_error',
  'retry_window_expired',
  'misregistered',
  'too_many_attempts',
  'outcome_uncertain',
  'partly_registered_overdue',
  'verification_gave_up',
  'repeatedly_not_registered',
  'student_number_stuck',
  'flagged_by_pipeline'
);

COMMENT ON TYPE credit_registration_attention_reason IS 'Why a live registration is in the Needs attention queue or running late. Derived at read time; stored only to record what a dismissal covered.';

CREATE TABLE credit_registration_attention_dismissals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  credit_registration_id UUID NOT NULL REFERENCES credit_registrations(id),
  dismissed_reasons credit_registration_attention_reason [] NOT NULL,
  dismissed_by_user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT credit_registration_attention_dismissals_reasons CHECK (CARDINALITY(dismissed_reasons) > 0),
  CONSTRAINT credit_registration_attention_dismissals_reason CHECK (TRIM(reason) <> '')
);
CREATE UNIQUE INDEX uq_credit_registration_attention_dismissals_registration ON credit_registration_attention_dismissals (credit_registration_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_credit_registration_attention_dismissals_created ON credit_registration_attention_dismissals (created_at DESC)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_attention_dismissals FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_attention_dismissals IS 'An admin taking a registration off the Needs attention queue. Separate from credit_registrations.needs_admin_attention, which is the pipeline''s own flag. The row stays off the queue while every reason it carries is one the dismissal covered; a different reason firing brings it back. A newer dismissal of the same registration soft-deletes the older one.';
COMMENT ON COLUMN credit_registration_attention_dismissals.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_attention_dismissals.credit_registration_id IS 'The registration taken off the queue.';
COMMENT ON COLUMN credit_registration_attention_dismissals.dismissed_reasons IS 'The reasons the registration carried when dismissed.';
COMMENT ON COLUMN credit_registration_attention_dismissals.dismissed_by_user_id IS 'The admin who dismissed it.';
COMMENT ON COLUMN credit_registration_attention_dismissals.reason IS 'Why, in the admin''s words. Also on the dismiss_attention audit row.';
COMMENT ON COLUMN credit_registration_attention_dismissals.created_at IS 'Timestamp when the record was created: when it was dismissed.';
COMMENT ON COLUMN credit_registration_attention_dismissals.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_attention_dismissals.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'dismiss_attention';

CREATE TYPE credit_registration_timeline_step AS ENUM (
  'course_not_registrable_yet',
  'waiting_for_student_number',
  'held_for_course_code',
  'looking_for_enrolment',
  'waiting_for_enrolment',
  'sending',
  'answer_unclear',
  'waiting_for_assessment_item',
  'waiting_for_course_unit',
  'registered',
  'already_in_sisu',
  'better_grade_in_sisu',
  'recorded_wrongly',
  'needs_a_person',
  'not_registering',
  'no_longer_registrable'
);

COMMENT ON TYPE credit_registration_timeline_step IS 'Where a registration stands on the admin timeline, derived from its ledger state and preconditions. Stored only in daily snapshots; the ledger never stores it.';

CREATE TYPE credit_registration_engagement AS ENUM ('pressed', 'visited', 'not_started');

COMMENT ON TYPE credit_registration_engagement IS 'What a student waiting on their own step has done on the registration page: pressed "I have enrolled", only visited, or neither.';

CREATE TABLE credit_registration_daily_step_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  timeline_step credit_registration_timeline_step NOT NULL,
  engagement credit_registration_engagement,
  count INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT credit_registration_daily_step_snapshots_count CHECK (count >= 0)
);
CREATE UNIQUE INDEX uq_credit_registration_daily_step_snapshots ON credit_registration_daily_step_snapshots (
  snapshot_date,
  timeline_step,
  engagement,
  deleted_at
) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_daily_step_snapshots FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_daily_step_snapshots IS 'Daily count of live registrations per timeline step, split by engagement on the steps that wait on the student. Counted with the same rules as the overview, so a day''s row equals what the overview showed then. No history before the table existed.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.snapshot_date IS 'The UTC day this row describes.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.timeline_step IS 'The timeline step counted.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.engagement IS 'The engagement counted, on the steps that wait on the student; NULL on every other step.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.count IS 'Live registrations at the step when the snapshot was taken.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_daily_step_snapshots.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

CREATE TABLE credit_registration_daily_attention_snapshots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  needs_attention_count INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT credit_registration_daily_attention_snapshots_count CHECK (needs_attention_count >= 0)
);
CREATE UNIQUE INDEX uq_credit_registration_daily_attention_snapshots ON credit_registration_daily_attention_snapshots (snapshot_date, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON credit_registration_daily_attention_snapshots FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE credit_registration_daily_attention_snapshots IS 'The Needs attention count once a day, for its trend line. No history before the table existed.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.snapshot_date IS 'The UTC day this row describes.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.needs_attention_count IS 'The Needs attention count when the snapshot was taken: the same number as the tab badge.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN credit_registration_daily_attention_snapshots.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
