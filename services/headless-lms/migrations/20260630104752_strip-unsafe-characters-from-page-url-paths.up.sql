-- Strip unsafe characters (spaces, colons, and the other URL_PATH_ENCODE_SET punctuation) from
-- course page URL paths, e.g. "/chapter-2/summary%3A-planetary-boundaries" becomes
-- "/chapter-2/summary-planetary-boundaries".
--
-- Background: slugs auto-generated from a page title already strip these characters, but a path
-- could still acquire them (manual path edits, imports), and `normalize_url_path_for_storage`
-- only percent-ENCODES unsafe ASCII (%20, %3A) rather than removing it, so the characters
-- persisted and surfaced in URLs.
--
-- For every course page whose path changes we insert a `url_redirections` row (old path -> page)
-- so existing links keep resolving — the same thing `update_page_details` does on a manual rename.
--
-- Non-ASCII characters (e.g. Cyrillic) are preserved verbatim, matching
-- `normalize_url_path_for_storage`; letter case is preserved too. Only non-deleted course pages
-- are touched: exam pages (course_id IS NULL) have no redirect mechanism, so renaming them would
-- break links with no fallback.
--
-- If two pages in the same course would clean to the same path, the migration ABORTS with a list
-- of the offending rows: cleaning one would shadow the other (the application resolves the cleaned
-- form first). Resolve the duplicates manually, then re-run. The cleanup is idempotent — once
-- paths are clean, re-running is a no-op.

-- Decode a run of %XX escapes back to UTF-8, tolerating invalid input. A manually entered or
-- imported path can contain a percent run that is not valid UTF-8 (e.g. a lone %80 or %FF); a bare
-- convert_from() would raise and abort the entire migration. Drop the undecodable run instead — it
-- is unsafe junk being cleaned away anyway — so one bad row can never block the deploy.
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

-- Percent-decode runs of %XX back to UTF-8, then strip the unsafe ASCII set, turn whitespace into
-- '-', and collapse/trim dashes per path segment. Mirrors the frontend slug rules but keeps
-- non-ASCII characters and letter case, and leaves the '/' separators, '-', '.', '_' and '~'
-- intact.
--
-- The stripped ASCII set below is the SQL spelling of `URL_PATH_ENCODE_SET`
-- (services/headless-lms/models/src/pages.rs) and the frontend `cleanUrlPath`
-- (services/main-frontend/src/utils/normalizePath.ts). The three must stay in agreement; this is
-- the hardest to read, so when the set changes update it here too.
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

-- Compute the cleaned target for every non-deleted course page once, so the heavy per-character
-- decode runs a single time per row instead of being recomputed in each of the statements below.
CREATE TEMP TABLE page_path_cleanup ON COMMIT DROP AS
SELECT id,
       course_id,
       url_path AS old_path,
       clean_url_path(url_path) AS new_path
FROM pages
WHERE deleted_at IS NULL
  AND course_id IS NOT NULL;

-- Abort if cleaning would collide within the pages unique index
-- (url_path, exam_id, course_id, deleted_at) NULLS NOT DISTINCT. Among non-deleted course pages
-- (exam_id is NULL for these), group every page by its cleaned target; any group of more than one
-- row is a collision, whether between a changed and an already-clean path or two paths that clean
-- to the same value.
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

-- Record a redirect from the old path to the page for every course page whose path will change,
-- so existing links keep resolving. Upsert against the unique constraint
-- (course_id, old_url_path, deleted_at) NULLS NOT DISTINCT (inserted rows have deleted_at NULL):
-- revive/repoint a matching active redirect if one already exists.
INSERT INTO url_redirections (id, destination_page_id, old_url_path, course_id)
SELECT gen_random_uuid(), c.id, c.old_path, c.course_id
FROM page_path_cleanup c
WHERE c.new_path <> c.old_path
ON CONFLICT (course_id, old_url_path, deleted_at)
DO UPDATE SET destination_page_id = EXCLUDED.destination_page_id,
              updated_at = now();

-- Apply the cleaned paths. Collisions were ruled out above, so this cannot violate the unique
-- index.
UPDATE pages p
SET url_path = c.new_path
FROM page_path_cleanup c
WHERE p.id = c.id
  AND c.new_path <> c.old_path;

DROP FUNCTION clean_url_path(text);
DROP FUNCTION safe_percent_decode(text);
