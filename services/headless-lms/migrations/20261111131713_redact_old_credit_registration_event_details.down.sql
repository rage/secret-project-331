ALTER TABLE credit_registration_events DROP COLUMN details_redacted_at;

COMMENT ON COLUMN credit_registration_events.details IS 'Scrubbed per-item Suotar exchange, shaped {"request": <the item we sent>, "response": <the result or error we got>}. Both sides, because the admin drill-down renders them side by side and inferring the request afterwards is guesswork the moment anything is retried. Either key may be absent for non-Suotar events. Passed through scrub_suotar_body at every write site, never at read time.';
