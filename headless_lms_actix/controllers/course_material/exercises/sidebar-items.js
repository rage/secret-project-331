initSidebarItems({"fn":[["_add_routes","Add a route for each controller in this module."],["get_exercise","GET `/api/v0/course-material/exercises/:exercise_id` - Get exercise by id. Includes relevant context so that doing the exercise is possible based on the response."],["get_peer_review_for_exercise","GET `/api/v0/course-material/exercises/:exercise_id/peer-review` - Get peer review for an exercise. This includes the submission to peer review and the questions the user is supposed to answer.ALTER"],["post_submission","POST `/api/v0/course-material/exercises/:exercise_id/submissions` - Post new submission for an exercise."],["resolve_course_instance_or_exam_id_and_verify_that_user_can_submit","Submissions for exams are posted from course instances or from exams. Make respective validations while figuring out which."],["start_peer_review","POST `/api/v0/course-material/exercises/:exercise_id/peer-reviews/start` - Post a signal indicating thatthe user will start peer reviewing process.This operation is only valid for exercises marked for peer reviews. No further submissions will beaccepted after posting to this endpoint.Response TypeScript definition"],["submit_peer_review","POST `/api/v0/course-material/exercises/:exercise_id/peer-reviews - Post a peer review for anexercise submission.Response TypeScript definition"]]});