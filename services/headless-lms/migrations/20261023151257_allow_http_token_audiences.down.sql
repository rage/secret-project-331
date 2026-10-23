ALTER TABLE oauth_refresh_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience));

ALTER TABLE oauth_access_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_uris_or_null(audience));

DROP FUNCTION are_valid_oauth_audiences_or_null(TEXT []);
