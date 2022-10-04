type CourseModuleCompletionWithRegistrationInfo = {
  completion_registration_attempt_date: Date | null
  course_module_id: string
  created_at: Date
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  registered: boolean
  user_id: string
}
