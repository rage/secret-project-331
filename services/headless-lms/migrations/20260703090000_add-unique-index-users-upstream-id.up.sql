-- Prevent concurrent user creations (e.g. parallel TMC-server create-user requests during
-- password migration) from inserting duplicate users for the same TMC account. Partial so that
-- soft-deleted users don't block re-creating an account with the same upstream_id.
-- If this migration fails, duplicate active users with the same upstream_id already exist and
-- must be merged manually first:
--   SELECT upstream_id, array_agg(id) FROM users
--   WHERE upstream_id IS NOT NULL AND deleted_at IS NULL
--   GROUP BY upstream_id HAVING count(*) > 1;
CREATE UNIQUE INDEX users_upstream_id_active_uniq_idx ON users (upstream_id)
WHERE upstream_id IS NOT NULL
  AND deleted_at IS NULL;
