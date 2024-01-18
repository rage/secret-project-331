type CourseModule = {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  name: string | null
  course_id: string
  order_number: number
  copied_from: string | null
  uh_course_code: string | null
  completion_policy: CompletionPolicy
  completion_registration_link_override: string | null
  ects_credits: number | null
  enable_registering_completion_to_uh_open_university: boolean
  certification_enabled: boolean
}
