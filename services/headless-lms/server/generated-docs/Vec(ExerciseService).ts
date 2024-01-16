type Vec<ExerciseService> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  name: string
  slug: string
  public_url: string
  internal_url: string | null
  max_reprocessing_submissions_at_once: number
}>
