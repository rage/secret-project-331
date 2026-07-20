-- Rebuild search_helper:
--   1. Keep exact substring search for both first-name last-name and last-name first-name input.
--   2. Drop the unused lower(search_helper) btree index; trigram GiST serves LIKE and distance queries.
-- Stored generated columns require immutable expressions, so do not use concat_ws.
DROP INDEX user_details_search_helper_gist;
DROP INDEX user_details_search_helper_lower;

ALTER TABLE user_details DROP COLUMN search_helper;

ALTER TABLE user_details
ADD COLUMN search_helper TEXT GENERATED ALWAYS AS (
    lower(
      REPLACE(
        user_id::text || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(last_name, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(email, ''),
        '  ',
        ' '
      )
    )
  ) STORED;

COMMENT ON COLUMN user_details.search_helper IS 'Helps us to search users with one trigram-indexed column. It contains user id, email, first-name last-name, and last-name first-name; both names are intentionally repeated so partial name searches work in either order.';
