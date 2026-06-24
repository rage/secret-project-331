-- Canonicalize stored URL paths to the decoded form used by `normalize_url_path_for_storage`.
--
-- Data created while the previous normalization was active (and any imported earlier) stored
-- non-ASCII characters percent-encoded, e.g. "/chapter-1/%D1%8F%D0%BA". The application now
-- stores and matches the decoded-canonical form ("/chapter-1/як"), where valid non-ASCII UTF-8
-- is kept verbatim and only unsafe ASCII (space, '#', '%', ...) stays percent-encoded.
--
-- This rewrites existing `pages.url_path` and `url_redirections.old_url_path` to that form. The
-- application's lookup already tolerates both representations, so this is a cleanup that makes
-- the stored data consistent. The statement is idempotent: re-running it is a no-op once paths
-- are decoded.
--
-- If decoding would make two rows in the same course collide (e.g. both a decoded
-- "/chapter-1/як" and an encoded "/chapter-1/%D1%8F%D0%BA" exist), the migration ABORTS with a
-- message listing the offending rows. Silently skipping them would leave the encoded row
-- orphaned: the application resolves the decoded form first, so the encoded duplicate would
-- become permanently unreachable. Such collisions must be resolved manually (delete or merge
-- the duplicate), after which the migration can be re-run.

-- Decodes runs of percent-encoded NON-ASCII bytes (lead nibble 8-F, i.e. byte >= 0x80) back to
-- raw UTF-8, while leaving literal characters and ASCII percent-escapes (%20, %23, %25, ...)
-- intact. This mirrors `normalize_url_path_for_storage` for already-normalized inputs.
CREATE FUNCTION decode_non_ascii_url_path(input text) RETURNS text
    LANGUAGE sql
    IMMUTABLE
    STRICT
AS $$
    SELECT string_agg(
        CASE
            WHEN token ~ '^(?:%[89A-Fa-f][0-9A-Fa-f])+$'
                THEN convert_from(decode(replace(token, '%', ''), 'hex'), 'UTF8')
            ELSE token
        END,
        ''
        ORDER BY ord
    )
    FROM (
        SELECT g[1] AS token, ord
        FROM regexp_matches(input, '((?:%[89A-Fa-f][0-9A-Fa-f])+|.)', 'g')
            WITH ORDINALITY AS r(g, ord)
    ) AS tokens;
$$;

-- Abort if decoding would collide within the pages unique index
-- (url_path, exam_id, course_id, deleted_at) NULLS NOT DISTINCT. We group every page by its
-- decoded target plus the rest of the index key: any group of more than one row is a collision,
-- whether it is a decoded vs. encoded pair or two different encodings of the same path. GROUP BY
-- treats equal values (including NULL = NULL) as the same group, matching NULLS NOT DISTINCT.
DO $$
DECLARE
    collisions text;
BEGIN
    SELECT string_agg(line, E'\n' ORDER BY line)
    INTO collisions
    FROM (
        SELECT format('  course %s exam %s deleted_at %s: %L (%s rows)', course_id, exam_id, deleted_at, target, count(*)) AS line
        FROM (
            SELECT course_id, exam_id, deleted_at,
                   CASE
                       WHEN url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
                           THEN decode_non_ascii_url_path(url_path)
                       ELSE url_path
                   END AS target
            FROM pages
        ) mapped
        GROUP BY course_id, exam_id, deleted_at, target
        HAVING count(*) > 1
    ) dups;

    IF collisions IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot normalize page URL paths: decoding would make these (url_path, exam_id, course_id, deleted_at) targets collide. Resolve the duplicates manually, then re-run the migration:%', E'\n' || collisions;
    END IF;
END $$;

-- Abort if decoding would collide within the url_redirections unique constraint
-- (course_id, old_url_path, deleted_at) NULLS NOT DISTINCT. GROUP BY treats equal deleted_at
-- (including NULL = NULL) as the same group, matching NULLS NOT DISTINCT.
DO $$
DECLARE
    collisions text;
BEGIN
    SELECT string_agg(line, E'\n' ORDER BY line)
    INTO collisions
    FROM (
        SELECT format('  course %s (deleted_at %s): %L (%s rows)', course_id, deleted_at, target, count(*)) AS line
        FROM (
            SELECT course_id, deleted_at,
                   CASE
                       WHEN old_url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
                           THEN decode_non_ascii_url_path(old_url_path)
                       ELSE old_url_path
                   END AS target
            FROM url_redirections
        ) mapped
        GROUP BY course_id, deleted_at, target
        HAVING count(*) > 1
    ) dups;

    IF collisions IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot normalize redirection URL paths: decoding would make these (course, old_url_path, deleted_at) targets collide. Resolve the duplicates manually, then re-run the migration:%', E'\n' || collisions;
    END IF;
END $$;

-- pages.url_path: collisions ruled out above, so the rewrite cannot violate the unique index.
WITH candidates AS (
    SELECT id, url_path, decode_non_ascii_url_path(url_path) AS new_url_path
    FROM pages
    WHERE url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
)
UPDATE pages AS p
SET url_path = c.new_url_path
FROM candidates c
WHERE p.id = c.id
  AND c.new_url_path <> c.url_path;

-- url_redirections.old_url_path
WITH candidates AS (
    SELECT id, old_url_path, decode_non_ascii_url_path(old_url_path) AS new_old_url_path
    FROM url_redirections
    WHERE old_url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
)
UPDATE url_redirections AS r
SET old_url_path = c.new_old_url_path
FROM candidates c
WHERE r.id = c.id
  AND c.new_old_url_path <> c.old_url_path;

DROP FUNCTION decode_non_ascii_url_path(text);
