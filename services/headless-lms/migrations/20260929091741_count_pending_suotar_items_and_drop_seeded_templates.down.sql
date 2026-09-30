ALTER TABLE suotar_api_calls DROP COLUMN pending_item_count;
COMMENT ON COLUMN suotar_api_calls.error_item_count IS 'How many items the response rejected.';
