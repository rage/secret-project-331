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
COMMENT ON COLUMN credit_registration_account_linking_emails.replaced_at IS 'When this row gave up its place in the dedup key: a later mail to the same person, course and address took it after this row''s link had expired or been used, or the person''s student number was unlinked with the link unused. NULL while the row holds that place.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because an earlier mail to that person and address for this course still had a usable link.';

ALTER TABLE credit_registration_roster_schedules
ADD COLUMN fetch_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN linking_listed_count INT,
  ADD COLUMN linking_already_linked_count INT,
  ADD COLUMN linking_mailed_count INT,
  ADD COLUMN linking_suppressed_by_dedup_count INT,
  ADD COLUMN linking_suppressed_by_rate_cap_count INT,
  ADD COLUMN linking_no_address_count INT;

COMMENT ON COLUMN credit_registration_roster_schedules.fetch_requested_at IS 'When an admin last asked for the enrolment list to be fetched. Until a fetch runs after it, the code is due at its next grid point; the rate limiter and the failure backoff still apply.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_listed_count IS 'Distinct people on the last enrolment list that fed account linking, of those enrolled since account linking began. Each is counted once however many modules share the code, in exactly one of the other linking_ counters. NULL until such a list arrives.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_already_linked_count IS 'Of linking_listed_count, those some account already holds a student number link for.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_mailed_count IS 'Of linking_listed_count, those a linking email was claimed for on at least one module.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_suppressed_by_dedup_count IS 'Of linking_listed_count, those mailed on no module because an earlier mail still had a usable link on at least one.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_suppressed_by_rate_cap_count IS 'Of linking_listed_count, those mailed on no module and held back only by the rate caps.';
COMMENT ON COLUMN credit_registration_roster_schedules.linking_no_address_count IS 'Of linking_listed_count, those the study registry holds no address for.';

ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'request_enrolment_list_fetch';
ALTER TYPE credit_registration_admin_action
ADD VALUE IF NOT EXISTS 'dismiss_study_registry_conflict';
ALTER TYPE credit_registration_admin_action_target
ADD VALUE IF NOT EXISTS 'roster_schedule';
ALTER TYPE credit_registration_admin_action_target
ADD VALUE IF NOT EXISTS 'study_registry_student_number_conflict';

ALTER TABLE credit_registration_roster_schedules
ADD COLUMN last_fetch_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_mailing_fetch_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN press_fetch_day DATE,
  ADD COLUMN press_fetch_count INT NOT NULL DEFAULT 0,
  ADD CONSTRAINT credit_registration_roster_schedules_press_fetch_count CHECK (press_fetch_count >= 0);
UPDATE credit_registration_roster_schedules
SET last_fetch_started_at = last_fetched_at,
  last_mailing_fetch_started_at = last_fetched_at;

COMMENT ON COLUMN credit_registration_roster_schedules.last_fetched_at IS 'When the enrolment list last arrived, or Suotar last said it holds no realisation of the code. The weekly fetch and the minimum gap between fetches are counted from here.';
COMMENT ON COLUMN credit_registration_roster_schedules.fetch_requested_at IS 'When an admin last asked for the enrolment list to be fetched. Until a fetch started after it arrives, the code is due at its next grid point; the rate limiter and the failure backoff still apply.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_fetch_started_at IS 'When the fetch behind last_fetched_at was sent. An admin''s fetch request is served only by a fetch sent after it, since one already in flight may have read the list before the request.';
COMMENT ON COLUMN credit_registration_roster_schedules.last_mailing_fetch_started_at IS 'When the latest arrived fetch that could claim linking mail was sent, that is one made with account linking on and link-emails not paused. A waiting person''s rungs and "I have enrolled" presses count as served from here.';
COMMENT ON COLUMN credit_registration_roster_schedules.press_fetch_day IS 'The UTC day press_fetch_count counts.';
COMMENT ON COLUMN credit_registration_roster_schedules.press_fetch_count IS 'How many fetches on press_fetch_day were due only because of "I have enrolled" presses, against the daily cap. Once at the cap, presses stop making the code due until the next UTC day.';

ALTER TABLE credit_registration_enrolment_check_signals
ADD COLUMN visit_ladder_anchor_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN check_request_ladder_anchor_at TIMESTAMP WITH TIME ZONE;
UPDATE credit_registration_enrolment_check_signals
SET visit_ladder_anchor_at = last_visited_at,
  check_request_ladder_anchor_at = last_check_requested_at;

COMMENT ON COLUMN credit_registration_enrolment_check_signals.visit_ladder_anchor_at IS 'The visit the enrolment list fetch ladder of an unlinked student is anchored on: the first visit a day or more after the previous anchor, so reloading the page does not push the rungs out.';
COMMENT ON COLUMN credit_registration_enrolment_check_signals.check_request_ladder_anchor_at IS 'The check request the enrolment list fetch ladder of an unlinked student is anchored on: the first request a day or more after the previous anchor, so pressing again does not restart the ladder.';

ALTER TABLE study_registry_student_number_conflicts
ADD COLUMN dismissed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN study_registry_student_number_conflicts.dismissed_at IS 'When an admin took the conflict off the list. A dismissed row stays live, so it keeps the same account and number from being recorded again.';
