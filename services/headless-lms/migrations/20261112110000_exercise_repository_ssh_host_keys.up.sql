CREATE TABLE exercise_repository_ssh_host_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  sha256_fingerprint TEXT NOT NULL,
  CONSTRAINT exercise_repository_ssh_host_keys_host_is_lowercase CHECK (host = lower(host)),
  CONSTRAINT exercise_repository_ssh_host_keys_port_range CHECK (
    port BETWEEN 1 AND 65535
  )
);

CREATE UNIQUE INDEX idx_exercise_repository_ssh_host_keys_host_port ON exercise_repository_ssh_host_keys (host, port)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_repository_ssh_host_keys FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_repository_ssh_host_keys IS 'The ssh host key first seen when cloning an exercise repository from a git server whose key is not built into the application (trust on first use). A later clone from that server must present the same key. Kept per server rather than per repository because the key belongs to the server: one remembered key protects every repository on it.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.created_at IS 'Timestamp when the key was first seen.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting the row is how an administrator accepts a server''s legitimately changed key: the next clone remembers the new one.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.host IS 'The git server''s host name as written in the clone URL, lowercased.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.port IS 'The ssh port the clone connected to.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.sha256_fingerprint IS 'The host key''s SHA-256 fingerprint, base64 without padding, as ssh-keygen -lf prints it after SHA256:.';
