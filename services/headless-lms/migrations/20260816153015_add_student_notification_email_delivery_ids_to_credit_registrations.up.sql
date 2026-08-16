ALTER TABLE credit_registrations
ADD COLUMN action_needed_email_delivery_id UUID REFERENCES email_deliveries(id),
  ADD COLUMN registered_email_delivery_id UUID REFERENCES email_deliveries(id);

COMMENT ON COLUMN credit_registrations.action_needed_email_delivery_id IS 'The delivery carrying the "we could not register your credits, you have no enrolment" mail. Set once and never cleared: it is what stops the mail being sent again when the row re-enters no_usable_enrolment.';
COMMENT ON COLUMN credit_registrations.registered_email_delivery_id IS 'The delivery carrying the "your credits are in the study registry" mail. Set once and never cleared. A grade-improvement attempt is a separate row and gets its own mail, which is intended: the grade in the registry changed.';

-- Serves the student-notifications claim query, and shrinks to near-empty in steady state because a
-- row leaves the predicate as soon as its mail is queued.
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
