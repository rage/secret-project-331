ALTER TABLE verified_student_numbers DROP COLUMN auto_link_notice_dismissed_at;

ALTER TABLE course_module_suotar_realisations DROP COLUMN last_fast_tracked_count,
  DROP COLUMN last_fast_track_skipped_no_account_count,
  DROP COLUMN last_fast_track_skipped_unverified_count,
  DROP COLUMN last_fast_track_skipped_stale_verification_count,
  DROP COLUMN last_fast_track_skipped_name_mismatch_count,
  DROP COLUMN last_fast_track_skipped_account_has_number_count,
  DROP COLUMN last_fast_track_skipped_unlinked_before_count;

DROP INDEX IF EXISTS idx_credit_registrations_unnotified;

ALTER TABLE credit_registrations DROP COLUMN action_needed_email_delivery_id,
  DROP COLUMN registered_email_delivery_id;
