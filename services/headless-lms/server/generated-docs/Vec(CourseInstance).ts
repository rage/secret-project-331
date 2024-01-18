type Vec<CourseInstance> = Array<{
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  course_id: string
  starts_at: string | null
  ends_at: string | null
  name: string | null
  description: string | null
  teacher_in_charge_name: string
  teacher_in_charge_email: string
  support_email: string | null
}>
