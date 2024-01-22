type Vec<GlobalCourseModuleStatEntry> = Array<{
  course_name: string
  course_id: string
  course_module_id: string
  course_module_name: string | null
  organization_id: string
  organization_name: string
  year: string
  value: number
  course_module_ects_credits: number | null
}>
