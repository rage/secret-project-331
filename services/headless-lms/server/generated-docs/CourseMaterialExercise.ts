type CourseMaterialExercise = {
  exercise: Exercise
  can_post_submission: boolean
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
  exercise_slide_submission_counts: Record<string, number>
  peer_review_config: PeerReviewConfig | null
  user_course_instance_exercise_service_variables: Array<UserCourseInstanceExerciseServiceVariable>
}
