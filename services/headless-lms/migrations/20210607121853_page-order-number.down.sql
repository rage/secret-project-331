ALTER TABLE pages DROP COLUMN order_number;
ALTER TABLE pages DROP CONSTRAINT pages_order_number_uniqueness;
