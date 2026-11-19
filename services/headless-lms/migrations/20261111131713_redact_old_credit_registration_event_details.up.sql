ALTER TABLE credit_registration_events
ADD COLUMN details_redacted_at TIMESTAMP WITH TIME ZONE;

-- Until this migration, details were redacted as they were written.
UPDATE credit_registration_events
SET details_redacted_at = created_at
WHERE details IS NOT NULL;

CREATE INDEX idx_credit_registration_events_details_unredacted ON credit_registration_events (created_at)
WHERE details IS NOT NULL
  AND details_redacted_at IS NULL;

COMMENT ON COLUMN credit_registration_events.details IS 'Per-item Suotar exchange, shaped {"request": <the item we sent>, "response": <the result or error we got>}. Both sides, because the admin drill-down renders them side by side and inferring the request afterwards is guesswork the moment anything is retried. Either key may be absent for non-Suotar events. Stored as sent and received; the retention sweep passes it through scrub_suotar_body once it is older than the Suotar call log''s retention window.';
COMMENT ON COLUMN credit_registration_events.details_redacted_at IS 'When personal data was removed from details. NULL while details still hold what Suotar was sent and answered.';
