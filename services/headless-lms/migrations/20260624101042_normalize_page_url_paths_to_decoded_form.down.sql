-- Intentionally a no-op.
--
-- The up migration is a one-way data normalization: it rewrites existing URL paths to the
-- decoded-canonical form but does not record which rows it touched, so it cannot be reverted
-- precisely. Reverting is also unnecessary — the application's page lookup tolerates both the
-- decoded and the legacy fully-encoded representations, so rolling the schema back does not
-- require restoring the encoded paths.
SELECT 1;
