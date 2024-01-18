type Vec<EmailTemplate> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  content: unknown | null
  name: string
  subject: string | null
  exercise_completions_threshold: number | null
  points_threshold: number | null
  course_instance_id: string
}>
