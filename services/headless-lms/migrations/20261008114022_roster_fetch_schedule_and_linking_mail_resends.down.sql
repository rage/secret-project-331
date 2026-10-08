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

ALTER TABLE credit_registration_roster_schedules DROP CONSTRAINT credit_registration_roster_schedules_consecutive_failures,
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
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because we had already mailed that person and address for this course.';
