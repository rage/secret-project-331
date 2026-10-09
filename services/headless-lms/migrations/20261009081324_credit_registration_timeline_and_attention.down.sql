DROP TABLE credit_registration_daily_attention_snapshots;
DROP TABLE credit_registration_daily_step_snapshots;
DROP TYPE credit_registration_engagement;
DROP TYPE credit_registration_timeline_step;

-- The enum value the up migration added cannot be dropped, so it stays.

DROP TABLE credit_registration_attention_dismissals;
DROP TYPE credit_registration_attention_reason;

ALTER TABLE credit_registrations DROP COLUMN state_changed_at,
  DROP COLUMN phase_started_at;
