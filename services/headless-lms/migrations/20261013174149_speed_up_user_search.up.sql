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

CREATE FUNCTION user_details_matches_search_pattern(
  name_search_helper TEXT,
  email_search_helper TEXT,
  search_pattern TEXT
) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
SELECT NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(search_pattern, '\s+') AS word
    WHERE NOT (
        name_search_helper LIKE '%' || word || '%' ESCAPE '\'
        OR email_search_helper LIKE '%' || word || '%' ESCAPE '\'
      )
  )
  OR word_similarity(search_pattern, name_search_helper) >= 0.5
  OR word_similarity(search_pattern, email_search_helper) >= 0.5
$$;

COMMENT ON FUNCTION user_details_matches_search_pattern(TEXT, TEXT, TEXT) IS 'Search box filter for user lists. True when every whitespace-separated word of search_pattern appears in the name or email, in any order, or when the whole pattern is a near match (word similarity at least 0.5) for a misspelled name or email. search_pattern must be lowercased with LIKE metacharacters escaped by backslash.';
