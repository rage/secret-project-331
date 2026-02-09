-- Email delivery retries
ALTER TABLE email_deliveries DROP COLUMN IF EXISTS error,
    ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN next_retry_at TIMESTAMPTZ NULL,
    ADD COLUMN retryable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN first_failed_at TIMESTAMPTZ NULL,
    ADD COLUMN last_attempt_at TIMESTAMPTZ NULL;

CREATE TABLE email_delivery_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_delivery_id UUID NOT NULL REFERENCES email_deliveries (id) ON DELETE CASCADE,
    attempt INT NOT NULL,
    error_message TEXT NOT NULL,
    error_code TEXT NULL,
    smtp_response TEXT NULL,
    smtp_response_code INT NULL,
    is_transient BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_delivery_errors_email_delivery_id_idx ON email_delivery_errors (email_delivery_id);

CREATE INDEX email_delivery_errors_created_at_idx ON email_delivery_errors (created_at);

CREATE INDEX email_deliveries_retry_queue_idx ON email_deliveries (next_retry_at)
WHERE sent = FALSE
    AND retryable = TRUE
    AND deleted_at IS NULL;

COMMENT ON TABLE email_delivery_errors IS 'Append-only log of individual email delivery failures; updated_at and deleted_at are intentionally omitted to preserve an immutable history of send attempts.';

COMMENT ON COLUMN email_delivery_errors.id IS 'Stable identifier for an individual email delivery error entry.';

COMMENT ON COLUMN email_delivery_errors.email_delivery_id IS 'Foreign key to the parent email_deliveries row this error belongs to.';

COMMENT ON COLUMN email_delivery_errors.attempt IS '1-based send attempt number at which this error occurred.';

COMMENT ON COLUMN email_delivery_errors.error_message IS 'Human-readable description of the failure returned by the mailer or application.';

COMMENT ON COLUMN email_delivery_errors.error_code IS 'Short machine-friendly classification of the failure (e.g. transient, permanent, timeout).';

COMMENT ON COLUMN email_delivery_errors.smtp_response IS 'Raw SMTP response text associated with the failure when available.';

COMMENT ON COLUMN email_delivery_errors.smtp_response_code IS 'Numeric SMTP status code associated with the failure when available.';

COMMENT ON COLUMN email_delivery_errors.is_transient IS 'Indicates whether the failure is considered transient and therefore retryable.';

COMMENT ON COLUMN email_delivery_errors.created_at IS 'Timestamp when this email delivery error entry was recorded.';

COMMENT ON COLUMN email_deliveries.retry_count IS 'Number of failed delivery attempts recorded so far for this email.';

COMMENT ON COLUMN email_deliveries.next_retry_at IS 'Next scheduled time when this email delivery will be retried, or NULL when no retry is scheduled.';

COMMENT ON COLUMN email_deliveries.retryable IS 'Indicates whether this email delivery is still eligible for further retry attempts.';

COMMENT ON COLUMN email_deliveries.first_failed_at IS 'Timestamp of the first failed delivery attempt for this email, used as the retry window anchor.';

COMMENT ON COLUMN email_deliveries.last_attempt_at IS 'Timestamp of the most recent delivery attempt for this email.';
