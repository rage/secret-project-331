type Vec<CourseModuleCompletion> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string
  course_instance_id: string
  course_module_id: string
  user_id: string
  completion_date: string
  completion_registration_attempt_date: string | null
  completion_language: string
  eligible_for_ects: boolean
  email: string
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  completion_granter_user_id: string | null
}>
