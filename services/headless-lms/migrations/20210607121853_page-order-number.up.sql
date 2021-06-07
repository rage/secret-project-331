-- Add up migration script here
ALTER TABLE pages
ADD COLUMN order_number INTEGER UNIQUE NOT NULL;
