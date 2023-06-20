--
ALTER TABLE courses
ALTER COLUMN content_search_language
SET DEFAULT 'simple'::REGCONFIG;
ALTER TABLE pages
ALTER COLUMN content_search_language
SET DEFAULT 'simple'::REGCONFIG;
ALTER TABLE courses
ALTER COLUMN content_search_language TYPE REGCONFIG USING content_search_language::REGCONFIG;
ALTER TABLE pages
ALTER COLUMN content_search_language TYPE REGCONFIG USING content_search_language::REGCONFIG;
