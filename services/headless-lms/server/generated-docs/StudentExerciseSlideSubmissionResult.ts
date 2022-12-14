type StudentExerciseSlideSubmissionResult = {
  exercise_status: ExerciseStatus | null
  exercise_task_submission_results: Array<StudentExerciseTaskSubmissionResult>
  user_course_instance_exercise_service_variables: Array<UserCourseInstanceExerciseServiceVariable>
}
