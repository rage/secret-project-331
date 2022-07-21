type Vec<StudyRegistryCompletion> = Array<{
  completion_date: Date
  completion_language: string
  completion_registration_attempt_date: Date | null
  email: string
  grade: StudyRegistryGrade
  id: string
  user_upstream_id: string
  tier: number | null
}>
