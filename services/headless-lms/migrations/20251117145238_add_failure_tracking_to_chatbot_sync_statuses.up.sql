ALTER TABLE chatbot_page_sync_statuses
ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN chatbot_page_sync_statuses.consecutive_failures IS 'Number of consecutive sync failures for this page. When this reaches MAX_CONSECUTIVE_FAILURES (5), the page will no longer be retried automatically. Failures include LLM processing errors, upload errors, or any other errors that prevent successful sync.';
