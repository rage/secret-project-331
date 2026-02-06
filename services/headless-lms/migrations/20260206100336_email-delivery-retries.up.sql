-- Email delivery retries
ALTER TABLE email_deliveries
    DROP COLUMN IF EXISTS error,
    ADD COLUMN retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN next_retry_at TIMESTAMPTZ NULL,
    ADD COLUMN retryable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN first_failed_at TIMESTAMPTZ NULL,
    ADD COLUMN last_attempt_at TIMESTAMPTZ NULL;

CREATE TABLE email_delivery_errors (
    id UUID PRIMARY KEY,
    email_delivery_id UUID NOT NULL REFERENCES email_deliveries (id) ON DELETE CASCADE,
    attempt INT NOT NULL,
    error_message TEXT NOT NULL,
    error_code TEXT NULL,
    smtp_response TEXT NULL,
    smtp_response_code INT NULL,
    is_transient BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_delivery_errors_email_delivery_id_idx
    ON email_delivery_errors (email_delivery_id);

CREATE INDEX email_delivery_errors_created_at_idx
    ON email_delivery_errors (created_at);

CREATE INDEX email_deliveries_retry_queue_idx
    ON email_deliveries (next_retry_at)
    WHERE sent = FALSE
      AND retryable = TRUE
      AND deleted_at IS NULL;
