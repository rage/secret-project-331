ALTER TABLE oauth_clients
  DROP CONSTRAINT IF EXISTS oauth_clients_client_secret_len_chk;
