type CourseMaterialExercise = {
  exercise: Exercise
  current_exercise_tasks: Array<CourseMaterialExerciseTask>
  exercise_status: ExerciseStatus | null
  previous_submission: ExerciseTaskSubmission | null
  grading: Grading | null
}
