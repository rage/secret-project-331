-- Canonicalize stored URL paths to the decoded form used by `normalize_url_path_for_storage`.
--
-- Data created while the previous normalization was active (and any imported earlier) stored
-- non-ASCII characters percent-encoded, e.g. "/chapter-1/%D1%8F%D0%BA". The application now
-- stores and matches the decoded-canonical form ("/chapter-1/як"), where valid non-ASCII UTF-8
-- is kept verbatim and only unsafe ASCII (space, '#', '%', ...) stays percent-encoded.
--
-- This rewrites existing `pages.url_path` and `url_redirections.old_url_path` to that form. The
-- application's lookup already tolerates both representations, so this is a cleanup that makes
-- the stored data consistent. Rows whose decoded value would collide with an existing row (per
-- the relevant unique index) are left untouched. The statement is idempotent: re-running it is a
-- no-op once paths are decoded.

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

-- pages.url_path (unique index: (url_path, course_id) WHERE deleted_at IS NULL)
WITH candidates AS (
    SELECT id, course_id, url_path, decode_non_ascii_url_path(url_path) AS new_url_path
    FROM pages
    WHERE url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
)
UPDATE pages AS p
SET url_path = c.new_url_path
FROM candidates c
WHERE p.id = c.id
  AND c.new_url_path <> c.url_path
  AND NOT EXISTS (
      SELECT 1
      FROM pages existing
      WHERE existing.id <> p.id
        AND existing.deleted_at IS NULL
        AND existing.course_id = p.course_id
        AND existing.url_path = c.new_url_path
  );

-- url_redirections.old_url_path
-- (unique constraint: (course_id, old_url_path, deleted_at) NULLS NOT DISTINCT)
WITH candidates AS (
    SELECT id, course_id, deleted_at, old_url_path,
           decode_non_ascii_url_path(old_url_path) AS new_old_url_path
    FROM url_redirections
    WHERE old_url_path ~ '%[89A-Fa-f][0-9A-Fa-f]'
)
UPDATE url_redirections AS r
SET old_url_path = c.new_old_url_path
FROM candidates c
WHERE r.id = c.id
  AND c.new_old_url_path <> c.old_url_path
  AND NOT EXISTS (
      SELECT 1
      FROM url_redirections existing
      WHERE existing.id <> r.id
        AND existing.course_id = r.course_id
        AND existing.deleted_at IS NOT DISTINCT FROM r.deleted_at
        AND existing.old_url_path = c.new_old_url_path
  );

DROP FUNCTION decode_non_ascii_url_path(text);
