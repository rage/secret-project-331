type Vec<ExerciseRepository> = Array<{
  id: string
  url: string
  course_id: string | null
  exam_id: string | null
  status: ExerciseRepositoryStatus
  error_message: string | null
}>
