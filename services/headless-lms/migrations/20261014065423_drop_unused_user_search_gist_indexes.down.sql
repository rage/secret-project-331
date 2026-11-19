CREATE INDEX IF NOT EXISTS user_details_name_search_helper_gist ON user_details USING gist (name_search_helper gist_trgm_ops);
CREATE INDEX IF NOT EXISTS user_details_email_local_part_gist ON user_details USING gist (split_part(email_search_helper, '@', 1) gist_trgm_ops);
