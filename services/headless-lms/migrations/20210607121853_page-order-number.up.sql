ALTER TABLE pages
ADD COLUMN order_number INTEGER NOT NULL;
CREATE UNIQUE INDEX pages_order_number_uniqueness ON pages (chapter_id, order_number)
WHERE deleted_at IS NULL;
