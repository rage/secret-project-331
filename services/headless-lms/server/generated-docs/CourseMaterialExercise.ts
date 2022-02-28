type CourseMaterialExercise = {
  exercise: Exercise
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
  exercise_slide_submission_counts: Record<string, number>
}
