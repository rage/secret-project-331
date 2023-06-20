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
