type CourseMaterialExercise = {
  exercise: Exercise
  can_post_submission: boolean
  current_exercise_slide: CourseMaterialExerciseSlide
  peer_review_info: CourseMaterialPeerReviewData | null
  exercise_status: ExerciseStatus | null
  exercise_slide_submission_counts: Record<string, number>
}
