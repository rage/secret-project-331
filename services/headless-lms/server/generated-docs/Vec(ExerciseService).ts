type Vec<ExerciseService> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}>
