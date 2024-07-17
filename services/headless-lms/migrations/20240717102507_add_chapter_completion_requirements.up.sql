-- Add up migration script here
ALTER TABLE course_modules
ADD COLUMN is_completion_requirement_by_chapter BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN course_modules.is_completion_requirement_by_chapter IS 'Determine if a chapter needs to specify its completion_requirement or not';
CREATE TABLE chapter_completion_requirements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  chapter_id UUID NOT NULL REFERENCES chapters,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  completion_points_treshold INTEGER,
  completion_number_of_exercises_attempted_treshold INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON chapter_completion_requirements FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE chapter_completion_requirements IS 'Contains completion requirement for a chapter when is_completion_require_by_chapter flag is set to true in course_modules';
COMMENT ON COLUMN chapter_completion_requirements.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN chapter_completion_requirements.course_instance_id IS 'The course_instance_id which this chapter is a part of.';
COMMENT ON COLUMN chapter_completion_requirements.chapter_id IS 'The chapter_id of the chapter.';
COMMENT ON COLUMN chapter_completion_requirements.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN chapter_completion_requirements.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN chapter_completion_requirements.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN chapter_completion_requirements.completion_points_treshold IS 'The point treshold set for this chapter by the instructor.';
COMMENT ON COLUMN chapter_completion_requirements.completion_number_of_exercises_attempted_treshold IS 'The number of exercises attempted treshold set for this chapter by the instructor.';
