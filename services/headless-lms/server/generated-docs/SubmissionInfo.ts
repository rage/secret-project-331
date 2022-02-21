type SubmissionInfo = {
  submission: ExerciseTaskSubmission
  exercise: Exercise
  exercise_task: ExerciseTask
  grading: ExerciseTaskGrading | null
  iframe_path: string
}
