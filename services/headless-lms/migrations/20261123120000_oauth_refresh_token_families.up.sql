ALTER TABLE oauth_refresh_tokens
ADD COLUMN family_id UUID;
-- Until now every (user, client) pair was one family.
UPDATE oauth_refresh_tokens AS t
SET family_id = f.family_id
FROM (
    SELECT user_id,
      client_id,
      uuid_generate_v4() AS family_id
    FROM oauth_refresh_tokens
    GROUP BY user_id,
      client_id
  ) AS f
WHERE f.user_id = t.user_id
  AND f.client_id = t.client_id;
ALTER TABLE oauth_refresh_tokens
ALTER COLUMN family_id
SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN family_id
SET NOT NULL;
CREATE INDEX oauth_refresh_tokens_family_id_idx ON oauth_refresh_tokens (family_id);
COMMENT ON COLUMN oauth_refresh_tokens.family_id IS 'The login this refresh token descends from: one per authorization-code or device-code redemption, inherited on rotation. Reuse detection and revoking a refresh token end only this family, so one login of a user does not end their others.';
ALTER TABLE oauth_access_tokens
ADD COLUMN refresh_token_family_id UUID;
UPDATE oauth_access_tokens AS a
SET refresh_token_family_id = (
    SELECT t.family_id
    FROM oauth_refresh_tokens AS t
    WHERE t.user_id = a.user_id
      AND t.client_id = a.client_id
    LIMIT 1
  )
WHERE a.user_id IS NOT NULL;
CREATE INDEX oauth_access_tokens_refresh_token_family_id_idx ON oauth_access_tokens (refresh_token_family_id)
WHERE refresh_token_family_id IS NOT NULL;
COMMENT ON COLUMN oauth_access_tokens.refresh_token_family_id IS 'The refresh-token family (oauth_refresh_tokens.family_id) this access token was issued with, so ending a family also ends its access tokens. NULL for an access token issued without a refresh token.';
