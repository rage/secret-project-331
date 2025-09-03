CREATE TYPE history_change_reason_new AS ENUM('page-saved', 'history-restored');

-- Delete from page_history such entries where history_change_reason='page-deleted',
-- because when this enum variant didn't exist, these entries wouldn't have been
-- created, therefore this loss of entries doesn't affect the application.
DELETE FROM page_history
WHERE history_change_reason = 'page-deleted';

ALTER TABLE page_history
ALTER COLUMN history_change_reason TYPE history_change_reason_new USING (
    history_change_reason::text::history_change_reason_new
  );

DROP TYPE history_change_reason;

ALTER TYPE history_change_reason_new
RENAME TO history_change_reason;
