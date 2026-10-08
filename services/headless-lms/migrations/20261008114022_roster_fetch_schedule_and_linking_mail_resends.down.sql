ALTER TABLE study_registry_student_number_conflicts DROP COLUMN dismissed_at;

DROP FUNCTION restarted_ladder_anchor(TIMESTAMP WITH TIME ZONE, INTERVAL);

ALTER TABLE credit_registration_enrolment_check_signals DROP COLUMN visit_ladder_anchor_at,
  DROP COLUMN check_request_ladder_anchor_at;

-- The enum values the up migration added cannot be dropped, so they stay.

DROP FUNCTION is_usable_verification_token(student_number_verification_tokens);

DROP INDEX uq_account_linking_email_person_course_address;
UPDATE credit_registration_account_linking_emails
SET deleted_at = replaced_at
WHERE replaced_at IS NOT NULL
  AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_account_linking_email_person_course_address ON credit_registration_account_linking_emails (
  sisu_person_id,
  course_id,
  LOWER(emailed_to),
  deleted_at
) NULLS NOT DISTINCT;
ALTER TABLE credit_registration_account_linking_emails DROP COLUMN replaced_at;
COMMENT ON TABLE credit_registration_account_linking_emails IS 'One row per account-linking mail we queued, keyed on the Sisu person id plus the recipient address. Prevents mailing the same Sisu person twice for the same course and backs the per-person rate caps.';

ALTER TABLE course_module_suotar_configurations
ADD COLUMN last_listed_person_count INT,
  ADD COLUMN last_already_linked_count INT,
  ADD COLUMN last_mailed_count INT,
  ADD COLUMN last_suppressed_by_dedup_count INT,
  ADD COLUMN last_suppressed_by_rate_cap_count INT,
  ADD COLUMN last_no_address_count INT;
COMMENT ON COLUMN course_module_suotar_configurations.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course: the last_* counters keep describing the last roster that did arrive.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listed_person_count IS 'Of the last listing, how many persons enrolled at or after account linking was switched on and so were considered for a linking mail. The rest are not counted: without a link we cannot tell who they are.';
COMMENT ON COLUMN course_module_suotar_configurations.last_already_linked_count IS 'Of the last listing, how many persons already had a linked account.';
COMMENT ON COLUMN course_module_suotar_configurations.last_mailed_count IS 'Of the last listing, how many linking mails were queued.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because we had already mailed that person and address for this course.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_rate_cap_count IS 'Of the last listing, how many mails were suppressed by a per-person rate cap.';
COMMENT ON COLUMN course_module_suotar_configurations.last_no_address_count IS 'Of the last listing, how many persons had no usable address to mail.';

ALTER TABLE credit_registration_roster_schedules DROP CONSTRAINT credit_registration_roster_schedules_counts,
  DROP COLUMN fetch_requested_at,
  DROP COLUMN last_fetch_started_at,
  DROP COLUMN last_mailing_fetch_started_at,
  DROP COLUMN fetch_day,
  DROP COLUMN fetch_day_count,
  DROP COLUMN linking_listed_count,
  DROP COLUMN linking_already_linked_count,
  DROP COLUMN linking_mailed_count,
  DROP COLUMN linking_suppressed_by_dedup_count,
  DROP COLUMN linking_suppressed_by_rate_cap_count,
  DROP COLUMN linking_no_address_count,
  ADD COLUMN triggered_fetch_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN follow_up_fetch_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN triggered_fetch_day DATE,
  ADD COLUMN triggered_fetch_count INT NOT NULL DEFAULT 0,
  ADD COLUMN window_closed_at TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT credit_registration_roster_schedules_counts CHECK (
    triggered_fetch_count >= 0
    AND consecutive_failures >= 0
  );
COMMENT ON TABLE credit_registration_roster_schedules IS 'When enrolment discovery lists each course code''s roster. The tier (three a day while completions keep coming, then daily, and weekly with account linking on) is derived at claim time from the modules on the code, so only what cannot be derived is kept here. Modules sharing a code share its row. The per-module counters on course_module_suotar_configurations still describe what each module did with the roster. No deleted_at: a row belongs to a course code, not to anything that is deleted, and one no module uses any more is simply never claimed.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_fetched_at IS 'When the roster last arrived. The tier interval is counted from here.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_at IS 'A listing an unlinked student''s visit or check request asked for, with account linking on. Claimed before any tier.';
COMMENT ON COLUMN credit_registration_roster_schedules.follow_up_fetch_at IS 'The one later listing an unlinked student''s visit books, for an enrolment Suotar''s copy of Sisu did not have yet.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_day IS 'The UTC day triggered_fetch_count counts.';
COMMENT ON COLUMN credit_registration_roster_schedules.triggered_fetch_count IS 'How many triggered and follow-up listings ran on triggered_fetch_day, against the daily cap.';
COMMENT ON COLUMN credit_registration_roster_schedules.window_closed_at IS 'When Suotar last said it holds no realisation of the code, which it does once the last one ended over two months ago. Tier listings stop until a completion arrives after this.';
