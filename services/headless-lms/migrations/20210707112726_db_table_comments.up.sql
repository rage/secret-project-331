-- Add up migration script here
COMMENT ON TABLE organizations IS 'A unit that organizes and manages courses e.g. University of Helsinki, Department of Computer Science.';
COMMENT ON TABLE courses IS 'Collection of course materials and exercises that define a online course.';
COMMENT ON TABLE pages IS 'A web page that either contains course material or information about a course.  The content of the page is stored in the content field as as an array of blocks that have to be rendered before showing to users. Each page has a unique URL which can be customized if necessary.';
COMMENT ON TABLE chapters IS 'Chapters divide pages of a course. They also have a front page.';
COMMENT ON TABLE submissions IS 'Students submission table. data_json is the specific submission data from a exercise and grading_id refers to the gradings table and it tells how the submission is to be graded.';
COMMENT ON TABLE exercise_tasks IS 'Exercise tasks contains the specific exercise which the students completes. Exercise has a assignments field as JSONB which contains info about the tasks to be completed. Table also contains both private and public specs. Private spec tells conditions where exercise is correct and is not shown to the student. Public spec is shown to the student.';
COMMENT ON TABLE course_instance_enrollments IS 'tells in which of the courses many instances certain user has enrolled to.';
COMMENT ON TABLE users IS 'Table which holds all registered users info.';
COMMENT ON TABLE roles IS 'Roles, which users can be assigned as. Roles are also related to courses and organizations so that each organization and course can have its specialized roles.';
COMMENT ON TABLE gradings IS 'Gradings are related to user submission regarding certain exercise and exercise task and it tells the score user got from it. Enum grading_progress tells how submission is to be graded.  Score_given tells the score user got from the submission. Feedback JSONB and Text are feedback to the students from the teacher.';
COMMENT ON TABLE regradings IS '???';
COMMENT ON TABLE regrading_submissions IS '???';
