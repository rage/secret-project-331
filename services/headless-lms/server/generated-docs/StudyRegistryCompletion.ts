type StudyRegistryCompletion = {
  completion_date: Date
  completion_language: string
  completion_registration_attempt_date: Date | null
  email: string
  grade: StudyRegistryGrade
  id: string
  user_id: string
  tier: number | null
}
