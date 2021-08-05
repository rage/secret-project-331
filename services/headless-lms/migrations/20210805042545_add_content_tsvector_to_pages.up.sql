-- Add up migration script here
ALTER table pages
ADD COLUMN content_search tsvector;
CREATE FUNCTION trigger_set_pages_content_search() RETURNS TRIGGER AS $$ BEGIN IF (
  (
    row (NEW.content) IS DISTINCT
    FROM row (OLD.content)
  )
  OR OLD.content_search IS NULL
  OR NEW.content_search IS NULL
) THEN NEW.content_search = setweight(
  to_tsvector('english', COALESCE(NEW.title, OLD.title)),
  'A'
) || setweight (
  -- we make sure the result won't be null because null here would erase the first tsvector
  COALESCE(
    (
      -- recursively search the content json and pick values that have keys ('content' or 'title'). Those are assumed to be attributes that need to be searchable
      WITH RECURSIVE recursive_search_operation(key, value) AS (
        SELECT NULL as key,
          jsonb_array_elements(NEW.content) AS value
        UNION ALL
        SELECT p.key,
          p.value
        FROM recursive_search_operation,
          jsonb_each(
            CASE
              WHEN jsonb_typeof(recursive_search_operation.value) <> 'object' THEN '{}'::jsonb
              ELSE recursive_search_operation.value
            END
          ) as p
      )
      SELECT to_tsvector('english', jsonb_agg(value))
      FROM recursive_search_operation
      WHERE jsonb_typeof(recursive_search_operation.value) <> 'object'
        AND (
          recursive_search_operation.key = 'content'
          OR recursive_search_operation.key = 'title'
        )
    ),
    to_tsvector('')
  ),
  'B'
);
RETURN NEW;
ELSE RETURN OLD;
END IF;
END
$$ language 'plpgsql';
-- trigger
CREATE trigger trigger_set_pages_content_search BEFORE
INSERT
  OR
UPDATE ON pages FOR EACH ROW EXECUTE PROCEDURE trigger_set_pages_content_search();
-- Update all pages to run the trigger for existing records
UPDATE pages
SET updated_at = now();
-- index for making search fast
CREATE INDEX pages_content_search ON pages USING GIN (content_search);