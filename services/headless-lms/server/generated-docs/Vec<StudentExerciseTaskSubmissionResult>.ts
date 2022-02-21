type Vec<StudentExerciseTaskSubmissionResult> = Array<{
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
}>
