ALTER TABLE exercises
ADD COLUMN chapter_id UUID REFERENCES chapters (id);
UPDATE exercises
SET chapter_id = (
    SELECT chapter_id
    FROM pages
    WHERE pages.id = exercises.page_id
  );
ALTER TABLE exercises
ALTER COLUMN chapter_id
SET NOT NULL;
