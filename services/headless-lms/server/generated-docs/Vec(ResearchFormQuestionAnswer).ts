type Vec<ResearchFormQuestionAnswer> = Array<{
  id: string
  user_id: string
  course_id: string
  research_form_question_id: string
  research_consent: boolean
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}>
