type Vec<EmailTemplate> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  content: unknown | null
  name: string
  subject: string | null
  exercise_completions_threshold: number | null
  points_threshold: number | null
  course_instance_id: string
}>
