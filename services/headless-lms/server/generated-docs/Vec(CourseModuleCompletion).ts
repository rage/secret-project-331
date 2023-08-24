type Vec<CourseModuleCompletion> = Array<{
  id: string
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  course_id: string
  course_instance_id: string
  course_module_id: string
  user_id: string
  completion_date: Date
  completion_registration_attempt_date: Date | null
  completion_language: string
  eligible_for_ects: boolean
  email: string
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  completion_granter_user_id: string | null
}>
