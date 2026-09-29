ALTER TYPE user_role
ADD VALUE 'credit_registration_admin';
ALTER TABLE credit_registration_events
ALTER COLUMN created_at
SET DEFAULT now(),
  ADD COLUMN suotar_endpoint suotar_endpoint,
  ADD COLUMN suotar_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN suotar_answered_at TIMESTAMP WITH TIME ZONE;
UPDATE credit_registration_events e
SET suotar_endpoint = c.endpoint,
  suotar_requested_at = c.started_at,
  suotar_answered_at = c.started_at + MAKE_INTERVAL(secs => c.duration_ms / 1000.0)
FROM suotar_api_calls c
WHERE c.id = e.suotar_api_call_id;
COMMENT ON COLUMN credit_registration_events.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN credit_registration_events.suotar_endpoint IS 'The Suotar endpoint whose answer or refusal this event records. Kept here because suotar_api_calls rows are swept after 90 days. NULL for events not about a Suotar exchange, and for older events whose call row was already swept.';
COMMENT ON COLUMN credit_registration_events.suotar_requested_at IS 'When the request this event records left for Suotar, taken by the registrar. NULL like suotar_endpoint.';
COMMENT ON COLUMN credit_registration_events.suotar_answered_at IS 'When Suotar''s answer or refusal arrived, taken by the registrar. The timeline sorts on this where set, since events written in one transaction share created_at. NULL like suotar_endpoint.';
