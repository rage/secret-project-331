-- 4. Remove added UH course code from modules
ALTER TABLE course_modules DROP COLUMN uh_course_code;
-- 3. 2. 1. Drop new tables
DROP TABLE course_module_completion_study_registry_registrations;
DROP TABLE study_registry_registrars;
DROP TABLE course_module_completions;
