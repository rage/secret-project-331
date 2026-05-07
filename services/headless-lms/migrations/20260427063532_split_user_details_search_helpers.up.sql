ALTER TABLE user_details
ADD COLUMN name_search_helper text GENERATED ALWAYS AS (
    lower(
      btrim(
        COALESCE(first_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(last_name, '') || ' ' ||
        COALESCE(first_name, '')
      )
    )
  ) STORED,
ADD COLUMN email_search_helper text GENERATED ALWAYS AS (
    lower(COALESCE(email, ''))
  ) STORED;

COMMENT ON COLUMN user_details.name_search_helper IS 'Generated helper column for typo-resistant user name search. Contains first-name last-name and last-name first-name in lowercase.';
COMMENT ON COLUMN user_details.email_search_helper IS 'Generated helper column for typo-resistant full email search in lowercase.';

CREATE INDEX user_details_name_search_helper_gist ON user_details USING gist (name_search_helper gist_trgm_ops);
CREATE INDEX user_details_email_search_helper_gist ON user_details USING gist (email_search_helper gist_trgm_ops);

DROP INDEX IF EXISTS user_details_search_helper_gist;
