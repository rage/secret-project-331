ALTER TABLE course_modules
  ADD CONSTRAINT uh_course_code_not_empty_string
  CHECK (TRIM(uh_course_code) <> '');

UPDATE course_modules SET uh_course_code = NULL WHERE TRIM(uh_course_code) = '';
