CREATE INDEX IF NOT EXISTS user_details_search_helper_gist ON user_details USING gist (search_helper gist_trgm_ops);

DROP INDEX IF EXISTS user_details_name_search_helper_gist;
DROP INDEX IF EXISTS user_details_email_search_helper_gist;

ALTER TABLE user_details
DROP COLUMN name_search_helper,
DROP COLUMN email_search_helper;
