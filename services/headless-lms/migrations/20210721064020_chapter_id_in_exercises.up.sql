-- Add up migration script here
ALTER TABLE exercises
ADD COLUMN chapter_id UUID NOT NULL;
ALTER TABLE exercises
ADD CONSTRAINT chapter_id_fk FOREIGN KEY (chapter_id) REFERENCES chapters (id);
COMMENT ON COLUMN exercises.chapter_id IS 'References the chapter in which exercise belongs to. Having the chapter_id_fk constraint prevents that exercises cannot be created to top level pages which are not related to any chapter.';
