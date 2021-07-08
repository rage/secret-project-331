-- Add up migration script here
COMMENT ON TABLE organizations IS 'A unit that organizes and manages courses e.g. University of Helsinki, Department of Computer Science.';
COMMENT ON TABLE courses IS 'Collection of course materials and exercises that define a online course.';
COMMENT ON TABLE pages IS 'A web page that either contains course material or information about a course.  The content of the page is stored in the content field as as an array of blocks that have to be rendered before showing to users. Each page has a unique URL which can be customized if necessary.';
COMMENT ON TABLE chapters IS 'Chapters divide pages of a course. They also have a front page.';
COMMENT ON TABLE submissions IS 'Students submission table. data_json is the specific submission data from a exercise and grading_id refers to the gradings table and it tells how the submission is to be graded.';
COMMENT ON TABLE exercise_tasks IS 'Exercise tasks contains the specific exercise which the students completes. Exercise has a assignments field as JSONB which contains info about the tasks to be completed. Table also contains both private and public specs. Private spec tells conditions where exercise is correct and is not shown to the student. Public spec is shown to the student.';
COMMENT ON TABLE course_instance_enrollments IS 'tells in which of the courses many instances certain user has enrolled to.';
COMMENT ON TABLE users IS 'Table which holds all registered users info.';
COMMENT ON TABLE roles IS 'Gives users permissions to perform actions in the system. Roles can also be related to courses and organizations so that each organization and course can have its specialized roles. If course_id is defined, the role is related to a course, if organization_id is defined and course_id is not defined, the role is related to an organization. Otherwise the role is global.';
COMMENT ON TABLE gradings IS 'Stores the result of grading done by an exercise service. Either created when a user submits an answer or when we're regrading answers. Feedback is stored either in textual form (feedback_text) or in a general form (feedback_json).';
COMMENT ON TABLE regradings IS 'A collection of submissions that will be graded again in the background. Created either by request from teachers or when we have edited exercise task specifications.';
COMMENT ON TABLE regrading_submissions IS 'Join table that tells which submissions belong in one regrading operation.';
