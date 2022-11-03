type CourseMaterialExercise = {
  exercise: Exercise
  can_post_submission: boolean
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
  exercise_slide_submission_counts: Record<string, number>
  peer_review_config: CourseMaterialPeerReviewConfig | null
  previous_exercise_slide_submission: ExerciseSlideSubmission | null
  user_course_instance_exercise_service_variables: Array<UserCourseInstanceExerciseServiceVariable>
}
