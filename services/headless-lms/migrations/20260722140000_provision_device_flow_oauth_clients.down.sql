-- Soft-delete the provisioned clients (the schema is soft-delete aware: the unique
-- client_id index is partial on deleted_at IS NULL, and lookups filter deleted_at).
-- Hard deletes would risk orphaning issued tokens / consent rows, so we deactivate instead.
UPDATE oauth_clients
SET deleted_at = now()
WHERE client_id IN ('tmc-cli-vscode', 'tmc-server-introspection')
  AND deleted_at IS NULL;
