type CourseModuleCompletionWithRegistrationInfo = {
  course_module_id: string
  grade: number | null
  passed: boolean
  prerequisite_modules_completed: boolean
  registered: boolean
  user_id: string
}
