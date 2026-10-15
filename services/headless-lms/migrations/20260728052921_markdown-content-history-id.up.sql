ALTER TABLE course_page_markdown_content
ADD COLUMN page_history_id UUID REFERENCES page_history(id),
  ADD COLUMN page_id UUID REFERENCES pages(id);

COMMENT ON COLUMN course_page_markdown_content.page_history_id IS 'The page history version that this Markdown was generated from.';
COMMENT ON COLUMN course_page_markdown_content.page_id IS 'The page that this Markdown was generated from, for convenience.';

-- set correct values in the new columns
UPDATE course_page_markdown_content AS cpmc
SET page_history_id = cps.synced_page_revision_id,
  page_id = cps.page_id
FROM chatbot_page_sync_statuses AS cps
WHERE cps.converted_markdown_content_id = cpmc.id
  AND cps.consecutive_failures = 0;

-- prepare to delete markdown_content rows with nulls in new columns
-- in case previous step missed some
UPDATE chatbot_page_sync_statuses AS cps
SET converted_markdown_content_id = NULL
FROM course_page_markdown_content AS cpmc
WHERE cpmc.id = cps.converted_markdown_content_id
  AND (
    cpmc.page_id IS NULL
    OR cpmc.page_history_id IS NULL
  );

DELETE FROM course_page_markdown_content
WHERE page_id IS NULL
  OR page_history_id IS NULL;

ALTER TABLE course_page_markdown_content
ALTER COLUMN page_history_id
SET NOT NULL;
ALTER TABLE course_page_markdown_content
ALTER COLUMN page_id
SET NOT NULL;

CREATE INDEX course_page_markdown_content_page_history_id ON course_page_markdown_content(page_history_id);

CREATE INDEX course_page_markdown_content_page_id ON course_page_markdown_content(page_id);
