ALTER TABLE exam_enrollments
ADD COLUMN is_teacher_testing BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exam_enrollments
ADD COLUMN show_exercise_answers BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exam_enrollments.is_teacher_testing IS 'Is the exam enrollment used for teacher previewing the exam';
COMMENT ON COLUMN exam_enrollments.show_exercise_answers IS 'Used when teacher is testing exam to show the answers if true';
