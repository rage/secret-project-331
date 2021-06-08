ALTER TABLE pages
ADD COLUMN order_number INTEGER NOT NULL;
ALTER TABLE pages
ADD CONSTRAINT pages_order_number_uniqueness UNIQUE (id, order_number);
