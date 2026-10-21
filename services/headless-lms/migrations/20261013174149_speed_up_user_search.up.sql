-- Fuzzy email search matches the local part only: shared domain trigrams made every gmail address
-- look similar to any gmail query.
CREATE INDEX IF NOT EXISTS user_details_email_local_part_gist ON user_details USING gist (split_part(email_search_helper, '@', 1) gist_trgm_ops);

-- Serves the fallback for rare and misspelled terms, where the GiST distance scans read most of
-- their index. Its expression matches no GiST index, so the planner cannot swap one in. The
-- expression must stay identical to the one in user_details::fuzzy_search_by_trigram_filter.
CREATE INDEX IF NOT EXISTS user_details_search_text_gin ON user_details USING gin (
  (name_search_helper || ' ' || split_part(email_search_helper, '@', 1)) gin_trgm_ops
);

DROP INDEX IF EXISTS user_details_email_trgm_idx;
DROP INDEX IF EXISTS user_details_email_search_helper_gist;

ALTER TABLE user_details DROP COLUMN IF EXISTS search_helper;
