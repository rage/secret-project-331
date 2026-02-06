DROP INDEX IF EXISTS email_deliveries_retry_queue_idx;
DROP INDEX IF EXISTS email_delivery_errors_created_at_idx;
DROP INDEX IF EXISTS email_delivery_errors_email_delivery_id_idx;

DROP TABLE IF EXISTS email_delivery_errors;

ALTER TABLE email_deliveries
    DROP COLUMN IF EXISTS last_attempt_at,
    DROP COLUMN IF EXISTS first_failed_at,
    DROP COLUMN IF EXISTS retryable,
    DROP COLUMN IF EXISTS next_retry_at,
    DROP COLUMN IF EXISTS retry_count,
    ADD COLUMN error VARCHAR(255) DEFAULT NULL;
