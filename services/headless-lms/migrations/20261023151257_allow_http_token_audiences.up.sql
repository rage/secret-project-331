CREATE FUNCTION are_valid_oauth_audiences_or_null(arr TEXT []) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v TEXT;
BEGIN IF arr IS NULL THEN RETURN TRUE;
END IF;
FOREACH v IN ARRAY arr LOOP IF v IS NULL
OR v !~* '^https?://[^\s#]+$' THEN RETURN FALSE;
END IF;
END LOOP;
RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION are_valid_oauth_audiences_or_null(TEXT []) IS 'Returns TRUE if the array is NULL or every entry is an absolute http(s) URL without a fragment. Audiences are resource server URLs, which are plain http on development hosts such as project-331.local.';

ALTER TABLE oauth_access_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_audiences_or_null(audience));

ALTER TABLE oauth_refresh_tokens DROP CONSTRAINT audience_uris_valid,
  ADD CONSTRAINT audience_uris_valid CHECK (are_valid_oauth_audiences_or_null(audience));
