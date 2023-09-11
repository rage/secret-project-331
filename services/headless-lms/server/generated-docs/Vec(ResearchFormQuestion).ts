type Vec<ResearchFormQuestion> = Array<{
  id: string
  course_id: string
  research_consent_form_id: string
  question: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}>
