-- Add up migration script here
ALTER TABLE regradings
ADD COLUMN error_message TEXT;
