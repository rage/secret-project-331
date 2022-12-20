type StudentExerciseTaskSubmissionResult = {
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
  exercise_task_exercise_service_slug: string
}
