type CourseMaterialExercise = {
  exercise: Exercise
  current_exercise_slide: CourseMaterialExerciseSlide
  exercise_status: ExerciseStatus | null
  grading: ExerciseTaskGrading | null
}
