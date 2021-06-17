-- Add up migration script here
ALTER TABLE exercises
ADD order_number integer NOT NULL default 0;
