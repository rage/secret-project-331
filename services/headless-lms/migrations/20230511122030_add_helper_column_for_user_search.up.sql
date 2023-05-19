CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE user_details
ADD COLUMN search_helper TEXT GENERATED ALWAYS AS (
    lower(
      replace(
        user_id::text || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(email, ''),
        '  ',
        ' '
      )
    )
  ) STORED;
COMMENT ON COLUMN user_details.search_helper IS 'A generated helper column that allows us to efficiently search for users by name or email.';
CREATE INDEX user_details_search_helper_gist ON user_details USING GIST (search_helper gist_trgm_ops);
CREATE INDEX user_details_search_helper_lower ON user_details (lower(search_helper));
