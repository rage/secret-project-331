ALTER TABLE credit_registrations
ADD COLUMN action_needed_email_delivery_id UUID REFERENCES email_deliveries(id),
  ADD COLUMN registered_email_delivery_id UUID REFERENCES email_deliveries(id),
  ADD COLUMN improvement_checked_completion_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN credit_registrations.improvement_checked_completion_updated_at IS 'The completion''s updated_at as of the last time the grade-improvement scan judged this accepted attempt and found no improvement. A completion touched for any other reason keeps matching the scan''s cheap "changed since the attempt" pre-filter, so without this watermark those rows fill every capped batch and a real regrade further down the queue is never reached.';

COMMENT ON COLUMN credit_registrations.action_needed_email_delivery_id IS 'The delivery carrying the "we could not register your credits, you have no enrolment" mail. Set once and never cleared: it is what stops the mail being sent again when the row re-enters no_usable_enrolment.';
COMMENT ON COLUMN credit_registrations.registered_email_delivery_id IS 'The delivery carrying the "your credits are in the study registry" mail. Set once and never cleared. A grade-improvement attempt is a separate row and gets its own mail, which is intended: the grade in the registry changed.';

-- Serves the student-notification claim query and stays near-empty, because a row leaves the
-- predicate as soon as its mail is queued.
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

ALTER TABLE course_module_suotar_realisations
ADD COLUMN last_fast_tracked_count INT,
  ADD COLUMN last_fast_track_skipped_no_account_count INT,
  ADD COLUMN last_fast_track_skipped_unverified_count INT,
  ADD COLUMN last_fast_track_skipped_stale_verification_count INT,
  ADD COLUMN last_fast_track_skipped_name_mismatch_count INT,
  ADD COLUMN last_fast_track_skipped_account_has_number_count INT,
  ADD COLUMN last_fast_track_skipped_unlinked_before_count INT;

COMMENT ON COLUMN course_module_suotar_realisations.last_fast_tracked_count IS 'Of the last listing, how many persons were linked without a mail because the study registry holds a verified account address for them.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_no_account_count IS 'Of the last listing, how many primary addresses matched no live account here. The ordinary linking mail covers these, and this is the bucket the whole linking flow exists for.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_unverified_count IS 'Of the last listing, how many primary addresses matched an account that has never proved control of it. This is the population an email-verification campaign would convert into fast tracks.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_stale_verification_count IS 'Of the last listing, how many matched accounts had a proof older than the configured recency bound.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_name_mismatch_count IS 'Of the last listing, how many matched accounts carried a name unlike the one the study registry holds. A rise here is the observable signature of a university address reissued to a different person.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_account_has_number_count IS 'Of the last listing, how many matched accounts already held a different student number. Replacing one silently is worse than mailing the link, whose confirmation screen names both numbers.';
COMMENT ON COLUMN course_module_suotar_realisations.last_fast_track_skipped_unlinked_before_count IS 'Of the last listing, how many matched accounts had already unlinked an automatic link for this person. Relinking them would make the unlink button theatre.';

ALTER TABLE verified_student_numbers
ADD COLUMN auto_link_notice_dismissed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN verified_student_numbers.auto_link_notice_dismissed_at IS 'When the student dismissed the notice telling them this link was made automatically. Only ever set for verified_via = email_match_fast_track; the notice and its one-click unlink are the compensating control for linking without asking.';

INSERT INTO credit_registration_phase_state (phase, process_name, expected_interval_secs)
VALUES ('ledger-snapshot', 'suotar-syncer', 86400);
