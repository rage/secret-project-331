ALTER TABLE user_details
ADD COLUMN IF NOT EXISTS search_helper TEXT GENERATED ALWAYS AS (
    lower(
      REPLACE(
        user_id::text || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(email, ''),
        '  ',
        ' '
      )
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS user_details_email_trgm_idx ON user_details USING gist (lower(email::text) gist_trgm_ops);
CREATE INDEX IF NOT EXISTS user_details_email_search_helper_gist ON user_details USING gist (email_search_helper gist_trgm_ops);

DROP INDEX IF EXISTS user_details_search_text_gin;
DROP INDEX IF EXISTS user_details_email_local_part_gist;
