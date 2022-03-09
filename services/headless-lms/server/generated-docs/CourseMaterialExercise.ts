type CourseMaterialExercise = {
  exercise: Exercise
  can_post_submission: boolean
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
}
