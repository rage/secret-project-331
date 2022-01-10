type CourseMaterialExercise = {
  exercise: Exercise
  current_exercise_task: CourseMaterialExerciseTask
  current_exercise_task_service_info: CourseMaterialExerciseServiceInfo | null
  exercise_status: ExerciseStatus | null
  previous_submission: Submission | null
  grading: Grading | null
}
