type Vec<SubmissionResult> = Array<{
  submission: ExerciseTaskSubmission
  grading: Grading | null
  model_solution_spec: unknown | null
}>
