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

-- Percent-decode runs of %XX back to UTF-8, then strip the unsafe ASCII set (everything in
-- URL_PATH_ENCODE_SET), turn whitespace into '-', and collapse/trim dashes per path segment.
-- Mirrors the frontend slug rules but keeps non-ASCII characters and letter case, and leaves the
-- '/' separators, '-', '.', '_' and '~' intact.
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
                    THEN convert_from(decode(replace(token, '%', ''), 'hex'), 'UTF8')
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
        SELECT format('  course %s: %L (%s pages)', course_id, target, count(*)) AS line
        FROM (
            SELECT course_id, clean_url_path(url_path) AS target
            FROM pages
            WHERE deleted_at IS NULL
              AND course_id IS NOT NULL
        ) mapped
        GROUP BY course_id, target
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
SELECT gen_random_uuid(), p.id, p.url_path, p.course_id
FROM pages p
WHERE p.deleted_at IS NULL
  AND p.course_id IS NOT NULL
  AND clean_url_path(p.url_path) <> p.url_path
ON CONFLICT (course_id, old_url_path, deleted_at)
DO UPDATE SET destination_page_id = EXCLUDED.destination_page_id,
              updated_at = now();

-- Apply the cleaned paths. Collisions were ruled out above, so this cannot violate the unique
-- index.
UPDATE pages p
SET url_path = clean_url_path(p.url_path)
WHERE p.deleted_at IS NULL
  AND p.course_id IS NOT NULL
  AND clean_url_path(p.url_path) <> p.url_path;

DROP FUNCTION clean_url_path(text);
