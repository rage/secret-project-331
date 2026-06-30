-- Strip unsafe characters (spaces, colons, and the other URL_PATH_ENCODE_SET punctuation) from
-- course page URL paths, e.g. "/chapter-2/summary%3A-planetary-boundaries" becomes
-- "/chapter-2/summary-planetary-boundaries".
--
-- One-time cleanup of paths written before `normalize_url_path_for_storage` started stripping
-- these characters (it used to percent-encode them, so %20/%3A persisted in URLs).
--
-- For every changed page we insert a `url_redirections` row (old path -> page) so existing links
-- keep resolving, as `update_page_details` does on a rename. Case and non-ASCII (e.g. Cyrillic)
-- are preserved. Only non-deleted course pages are touched: exam pages (course_id IS NULL) have no
-- redirect mechanism, so renaming them would break links.
--
-- If two pages in a course would clean to the same path the migration ABORTS listing them;
-- resolve the duplicates and re-run. Idempotent once paths are clean.

-- Decode a run of %XX escapes to UTF-8, tolerating invalid input: a non-UTF-8 percent run (e.g. a
-- lone %80) would otherwise abort the whole migration. Drop the undecodable run — it's unsafe junk
-- being cleaned anyway.
CREATE FUNCTION safe_percent_decode(token text) RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
AS $$
BEGIN
    RETURN convert_from(decode(replace(token, '%', ''), 'hex'), 'UTF8');
EXCEPTION
    WHEN others THEN
        RETURN '';
END;
$$;

-- Decode %XX runs to UTF-8, then strip the unsafe ASCII set, turn whitespace into '-', and
-- collapse/trim dashes per segment. Keeps case, non-ASCII, and '/', '-', '.', '_', '~'.
-- The stripped set is the SQL spelling of URL_PATH_ENCODE_SET (pages.rs) and the frontend
-- cleanUrlPath; keep the three in agreement.
CREATE FUNCTION clean_url_path(input text) RETURNS text
    LANGUAGE plpgsql
    IMMUTABLE
    STRICT
AS $$
DECLARE
    decoded text;
    s text;
BEGIN
    SELECT string_agg(
               CASE WHEN token ~ '^(?:%[0-9A-Fa-f]{2})+$'
                    THEN safe_percent_decode(token)
                    ELSE token END,
               '' ORDER BY ord)
    INTO decoded
    FROM (
        SELECT g[1] AS token, ord
        FROM regexp_matches(input, '((?:%[0-9A-Fa-f]{2})+|.)', 'g') WITH ORDINALITY AS r(g, ord)
    ) t;

    s := coalesce(decoded, '');
    s := regexp_replace(s, '[[:space:]]+', '-', 'g');                                   -- whitespace -> dash
    s := regexp_replace(s, '[\x00-\x2C\x3A-\x40\x5B-\x5E\x60\x7B-\x7D\x7F]', '', 'g');  -- drop unsafe ASCII
    s := regexp_replace(s, '-{2,}', '-', 'g');                                          -- collapse dashes
    s := regexp_replace(s, '-+/', '/', 'g');                                            -- trailing dash in a segment
    s := regexp_replace(s, '/-+', '/', 'g');                                            -- leading dash in a segment
    s := regexp_replace(s, '^-+', '');
    s := regexp_replace(s, '-+$', '');
    RETURN s;
END;
$$;

-- Compute each page's cleaned path once so the per-character decode doesn't re-run in every
-- statement below.
CREATE TEMP TABLE page_path_cleanup ON COMMIT DROP AS
SELECT id,
       course_id,
       url_path AS old_path,
       clean_url_path(url_path) AS new_path
FROM pages
WHERE deleted_at IS NULL
  AND course_id IS NOT NULL;

-- Abort if cleaning would collide within the pages unique index (url_path, exam_id, course_id,
-- deleted_at): group by cleaned target, any group of more than one row is a collision.
DO $$
DECLARE
    collisions text;
BEGIN
    SELECT string_agg(line, E'\n' ORDER BY line)
    INTO collisions
    FROM (
        SELECT format('  course %s: %L (%s pages)', course_id, new_path, count(*)) AS line
        FROM page_path_cleanup
        GROUP BY course_id, new_path
        HAVING count(*) > 1
    ) dups;

    IF collisions IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot clean page URL paths: cleaning would make these (course, url_path) targets collide. Resolve the duplicates manually, then re-run the migration:%', E'\n' || collisions;
    END IF;
END $$;

-- Redirect old path -> page for every changed path so existing links keep resolving. Upsert on
-- (course_id, old_url_path, deleted_at): revive/repoint an existing active redirect.
INSERT INTO url_redirections (id, destination_page_id, old_url_path, course_id)
SELECT gen_random_uuid(), c.id, c.old_path, c.course_id
FROM page_path_cleanup c
WHERE c.new_path <> c.old_path
ON CONFLICT (course_id, old_url_path, deleted_at)
DO UPDATE SET destination_page_id = EXCLUDED.destination_page_id,
              updated_at = now();

-- Apply the cleaned paths (collisions ruled out above).
UPDATE pages p
SET url_path = c.new_path
FROM page_path_cleanup c
WHERE p.id = c.id
  AND c.new_path <> c.old_path;

DROP FUNCTION clean_url_path(text);
DROP FUNCTION safe_percent_decode(text);
