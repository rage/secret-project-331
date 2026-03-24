-- Enforce fixed length for oauth_clients.client_secret (SHA-256 digest, 32 bytes)
ALTER TABLE oauth_clients
  ADD CONSTRAINT oauth_clients_client_secret_len_chk
  CHECK (
    client_secret IS NULL
    OR octet_length(client_secret) = 32
  );
