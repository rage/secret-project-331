-- Add down migration script here
DELETE FROM pg_description
WHERE objsubid > 0;
