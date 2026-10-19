DROP TABLE course_module_ending_questions_answers;
DROP TABLE course_module_ending_questions;
ALTER TABLE course_modules DROP COLUMN IF EXISTS ending_questions_required;
DROP TYPE IF EXISTS end_question_type;
