type Vec<MaterialReference> = Array<{
  id: string
  course_id: string
  citation_key: string
  reference: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}>
