ALTER TABLE credit_registration_roster_schedules DROP CONSTRAINT credit_registration_roster_schedules_counts,
  DROP COLUMN triggered_fetch_at,
  DROP COLUMN follow_up_fetch_at,
  DROP COLUMN triggered_fetch_day,
  DROP COLUMN triggered_fetch_count,
  DROP COLUMN window_closed_at,
  ADD CONSTRAINT credit_registration_roster_schedules_consecutive_failures CHECK (consecutive_failures >= 0);

COMMENT ON TABLE credit_registration_roster_schedules IS 'When enrolment discovery fetches each course code''s enrolment list. Every fetch falls on the code''s own grid, points 20 minutes apart at an offset fixed per code, so codes spread evenly over the hour. A code is due weekly, and sooner while people waiting for a student number on its modules are due on their ladders; both are derived at claim time, so only what cannot be derived is kept here. Modules sharing a code share its row. The per-module counters on course_module_suotar_configurations still describe what each module did with the list. No deleted_at: a row belongs to a course code, not to anything that is deleted, and one no module uses any more is simply never claimed.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_fetched_at IS 'When the enrolment list last arrived, or Suotar last said it holds no realisation of the code. The weekly fetch is counted from here, and a waiting person''s rung counts as served once a fetch has run after it.';

ALTER TABLE credit_registration_account_linking_emails
ADD COLUMN replaced_at TIMESTAMP WITH TIME ZONE;

DROP INDEX uq_account_linking_email_person_course_address;
CREATE UNIQUE INDEX uq_account_linking_email_person_course_address ON credit_registration_account_linking_emails (sisu_person_id, course_id, LOWER(emailed_to))
WHERE deleted_at IS NULL
  AND replaced_at IS NULL;

COMMENT ON TABLE credit_registration_account_linking_emails IS 'One row per account-linking mail we queued, keyed on the Sisu person id plus the recipient address. While its link can still be used, a row blocks another mail to the same person, course and address; replaced rows still count against the per-person rate caps.';
COMMENT ON COLUMN credit_registration_account_linking_emails.replaced_at IS 'When a later mail to the same person, course and address took this row''s place in the dedup key, after this row''s link had expired or been used. NULL while the row holds that place.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because an earlier mail to that person and address for this course still had a usable link.';
