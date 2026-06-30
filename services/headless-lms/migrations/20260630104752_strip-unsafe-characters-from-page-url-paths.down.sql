-- Intentionally a no-op.
--
-- The up migration is a one-way data cleanup: it rewrites page URL paths and does not record
-- which rows it changed, so it cannot be reverted precisely. Reverting is also unnecessary —
-- for every changed page it inserted a url_redirections row from the old path, so links using the
-- old (unclean) paths keep resolving regardless of the schema version.
SELECT 1;
