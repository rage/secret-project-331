-- Add up migration script here
ALTER TYPE history_change_reason
ADD VALUE IF NOT EXISTS 'page-deleted';
