type Vec<SubmissionResult> = Array<{
  submission: ExerciseTaskSubmission
  grading: ExerciseTaskGrading | null
  model_solution_spec: unknown | null
}>
