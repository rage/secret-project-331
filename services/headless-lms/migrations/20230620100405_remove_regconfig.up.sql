ALTER TABLE courses
ALTER COLUMN content_search_language TYPE varchar(255);
ALTER TABLE pages
ALTER COLUMN content_search_language TYPE varchar(255);
--
ALTER TABLE courses
ALTER COLUMN content_search_language
SET DEFAULT 'simple';
ALTER TABLE pages
ALTER COLUMN content_search_language
SET DEFAULT 'simple';
-- Automatically updates pages.content_search and pages.content_search_original_text columns using the function extract_searchable_text_from_document_schema.
CREATE OR REPLACE FUNCTION trigger_set_pages_content_search() RETURNS TRIGGER AS $$ BEGIN IF (
    (
      row (NEW.content) IS DISTINCT
      FROM row (OLD.content)
    )
    OR OLD.content_search IS NULL
    OR NEW.content_search IS NULL
  ) THEN
declare begin NEW.content_search = setweight(
    to_tsvector(
      NEW.content_search_language::REGCONFIG,
      NEW.title
    ),
    'A'
  ) || setweight (
    (
      SELECT coalesce(
          to_tsvector(
            NEW.content_search_language::REGCONFIG,
            jsonb_agg(value)
          ),
          to_tsvector('')
        )
      FROM (
          SELECT *
          FROM extract_searchable_text_from_document_schema(NEW.content)
        ) as value
    ),
    'B'
  );
NEW.content_search_original_text = (
  SELECT string_agg(res.value->>0, ' ') as original_text
  FROM (
      SELECT extract_searchable_text_from_document_schema(NEW.content) as value
    ) as res
);
end;
END IF;
RETURN NEW;
END $$ language 'plpgsql';
