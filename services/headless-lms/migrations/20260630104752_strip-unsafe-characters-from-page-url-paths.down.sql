-- No-op: the up migration is a one-way data cleanup that doesn't record which rows it changed, so
-- it can't be reverted. The redirects it inserts keep old links working.
SELECT 1;
