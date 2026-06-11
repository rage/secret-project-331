-- Add up migration script here
ALTER TYPE application_task
ADD VALUE IF NOT EXISTS 'sisu-description-summary';
