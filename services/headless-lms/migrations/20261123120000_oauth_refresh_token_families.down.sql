ALTER TABLE oauth_access_tokens DROP COLUMN refresh_token_family_id;
ALTER TABLE oauth_refresh_tokens DROP COLUMN family_id;
